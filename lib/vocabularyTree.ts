"use client";

import { supabase } from "@/lib/supabase";

export type VocabularyNodeType = "folder" | "deck";
export type VocabularyVisibility = "private" | "public" | "unlisted";

export interface VocabularyNode {
  id: string;
  user_id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  type: VocabularyNodeType;
  visibility: VocabularyVisibility;
  level: string | null;
  category: string | null;
  tags: string[];
  order_index: number;
  created_at: string;
  updated_at: string;
  child_folder_count: number;
  child_deck_count: number;
  card_count: number;
  total_card_count: number;
  save_count?: number;
  studied_count?: number;
  due_count?: number;
  legacy_deck_id?: string;
}

export interface VocabularyProfile {
  id: string;
  email: string;
}

export interface CreateNodeInput {
  parentId: string | null;
  title: string;
  description: string | null;
  type: VocabularyNodeType;
  visibility: VocabularyVisibility;
  level?: string | null;
  category?: string | null;
  tags?: string[];
}

export interface RenameNodeInput {
  nodeId: string;
  title: string;
  description: string | null;
  visibility?: VocabularyVisibility;
}

export async function getCurrentProfile(): Promise<VocabularyProfile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Chưa đăng nhập");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (error || !profile) throw new Error("Không tìm thấy hồ sơ người dùng.");

  return { id: profile.id as string, email: user.email ?? "" };
}

export async function fetchMyNodes(profileId: string, parentId: string | null) {
  const query = supabase
    .from("vocabulary_node_stats")
    .select("*")
    .eq("user_id", profileId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: false });

  const { data, error } = parentId
    ? await query.eq("parent_id", parentId)
    : await query.is("parent_id", null);

  if (!error && data) return data as VocabularyNode[];
  if (!isMissingVocabularyTree(error)) throw error;

  if (parentId) return [];
  return fetchLegacyDeckNodes(profileId);
}

export async function fetchCommunityNodes(parentId: string | null) {
  const query = supabase
    .from("vocabulary_node_stats")
    .select("*")
    .eq("visibility", "public")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: false });

  const { data, error } = parentId
    ? await query.eq("parent_id", parentId)
    : await query.is("parent_id", null);

  if (!error && data) return data as VocabularyNode[];
  if (isMissingVocabularyTree(error)) return [];
  throw error;
}

export async function fetchSavedNodes(profileId: string) {
  const { data, error } = await supabase
    .from("vocabulary_saved_nodes")
    .select("node_id, created_at")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingCommunityTables(error)) return [];
    throw error;
  }

  const savedRows = (data ?? []) as Array<{ node_id: string; created_at: string }>;
  if (savedRows.length === 0) return [];

  const savedAtByNodeId = new Map(
    savedRows.map((row) => [row.node_id, row.created_at]),
  );

  const { data: nodes, error: nodesError } = await supabase
    .from("vocabulary_node_stats")
    .select("*")
    .in(
      "id",
      savedRows.map((row) => row.node_id),
    );

  if (nodesError) throw nodesError;

  return ((nodes ?? []) as VocabularyNode[])
    .map((node) => ({
      ...node,
      saved_at: savedAtByNodeId.get(node.id) ?? node.created_at,
    }))
    .sort((left, right) =>
      String((right as VocabularyNode & { saved_at?: string }).saved_at).localeCompare(
        String((left as VocabularyNode & { saved_at?: string }).saved_at),
      ),
    );
}

export async function fetchNode(nodeId: string) {
  const { data, error } = await supabase
    .from("vocabulary_node_stats")
    .select("*")
    .eq("id", nodeId)
    .maybeSingle();

  if (!error) return (data as VocabularyNode | null) ?? null;
  if (isMissingVocabularyTree(error)) return null;
  throw error;
}

export async function fetchBreadcrumb(nodeId: string | null) {
  if (!nodeId) return [];

  const result: VocabularyNode[] = [];
  let currentId: string | null = nodeId;

  for (let index = 0; currentId && index < 16; index += 1) {
    const node = await fetchNode(currentId);
    if (!node) break;
    result.unshift(node);
    currentId = node.parent_id;
  }

  return result;
}

export async function fetchFolderOptions(profileId: string) {
  const { data, error } = await supabase
    .from("vocabulary_nodes")
    .select("id, parent_id, title")
    .eq("user_id", profileId)
    .eq("type", "folder")
    .order("title", { ascending: true });

  if (!error && data) return data as Pick<VocabularyNode, "id" | "parent_id" | "title">[];
  if (isMissingVocabularyTree(error)) return [];
  throw error;
}

export async function createVocabularyNode(profileId: string, input: CreateNodeInput) {
  if (input.type === "deck") {
    const { data: deck, error: deckError } = await supabase
      .from("decks")
      .insert({
        user_id: profileId,
        name: input.title,
        description: input.description,
      })
      .select("id")
      .single();

    if (deckError) throw deckError;

    const deckId = deck.id as string;
    const { error: nodeUpdateError } = await supabase
      .from("vocabulary_nodes")
      .update({
        parent_id: input.parentId,
        title: input.title,
        description: input.description,
        visibility: input.visibility,
        level: input.level ?? null,
        category: input.category ?? null,
        tags: input.tags ?? [],
      })
      .eq("id", deckId);

    if (nodeUpdateError && input.parentId) {
      throw new Error("Deck đã được tạo, nhưng cần chạy migration vocabulary_nodes để đặt deck vào thư mục.");
    }

    return deckId;
  }

  const { data, error } = await supabase
    .from("vocabulary_nodes")
    .insert({
      user_id: profileId,
      parent_id: input.parentId,
      title: input.title,
      description: input.description,
      type: input.type,
      visibility: input.visibility,
      level: input.level ?? null,
      category: input.category ?? null,
      tags: input.tags ?? [],
    })
    .select("id")
    .single();

  if (!error) return data?.id as string;

  if (isMissingVocabularyTree(error)) {
    throw new Error("Cần chạy migration vocabulary_nodes để tạo thư mục lồng nhau.");
  }

  throw error;
}

export async function renameVocabularyNode(profileId: string, input: RenameNodeInput) {
  const existing = await fetchNode(input.nodeId);
  const { error } = await supabase
    .from("vocabulary_nodes")
    .update({
      title: input.title,
      description: input.description,
      ...(input.visibility ? { visibility: input.visibility } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.nodeId)
    .eq("user_id", profileId);

  if (!error) {
    if (existing?.type === "deck") {
      await supabase
        .from("decks")
        .update({ name: input.title, description: input.description })
        .eq("id", input.nodeId)
        .eq("user_id", profileId);
    }
    return;
  }

  if (isMissingVocabularyTree(error)) {
    const { error: deckError } = await supabase
      .from("decks")
      .update({ name: input.title, description: input.description })
      .eq("id", input.nodeId)
      .eq("user_id", profileId);

    if (deckError) throw deckError;
    return;
  }

  throw error;
}

export async function moveVocabularyNode(profileId: string, nodeId: string, parentId: string | null) {
  if (nodeId === parentId) throw new Error("Không thể di chuyển vào chính nó.");

  const { error } = await supabase
    .from("vocabulary_nodes")
    .update({ parent_id: parentId, updated_at: new Date().toISOString() })
    .eq("id", nodeId)
    .eq("user_id", profileId);

  if (!error) return;
  if (isMissingVocabularyTree(error)) {
    throw new Error("Cần chạy migration vocabulary_nodes để di chuyển thư mục/bộ từ.");
  }
  throw error;
}

export async function deleteVocabularyNode(profileId: string, node: VocabularyNode) {
  if (node.legacy_deck_id) {
    await supabase.from("cards").delete().eq("deck_id", node.id);
    const { error } = await supabase
      .from("decks")
      .delete()
      .eq("id", node.id)
      .eq("user_id", profileId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("vocabulary_nodes")
    .delete()
    .eq("id", node.id)
    .eq("user_id", profileId);

  if (error) throw error;
}

export async function copyCommunityNode(profileId: string, nodeId: string, parentId: string | null) {
  const { error } = await supabase.rpc("copy_vocabulary_node_tree", {
    source_node_id: nodeId,
    target_user_id: profileId,
    target_parent_id: parentId,
  });

  if (error) {
    throw new Error(
      "Chưa có RPC copy_vocabulary_node_tree. Hãy chạy migration kèm function copy cây trước.",
    );
  }
}

export async function saveCommunityNode(profileId: string, nodeId: string) {
  const { error } = await supabase.from("vocabulary_saved_nodes").upsert(
    {
      user_id: profileId,
      node_id: nodeId,
    },
    { onConflict: "user_id,node_id" },
  );

  if (error) {
    if (isMissingCommunityTables(error)) {
      throw new Error("Cần chạy migration community_saves_reports để bật Lưu về học.");
    }
    throw error;
  }
}

export async function unsaveCommunityNode(profileId: string, nodeId: string) {
  const { error } = await supabase
    .from("vocabulary_saved_nodes")
    .delete()
    .eq("user_id", profileId)
    .eq("node_id", nodeId);

  if (error) throw error;
}

export async function isCommunityNodeSaved(profileId: string, nodeId: string) {
  const { data, error } = await supabase
    .from("vocabulary_saved_nodes")
    .select("id")
    .eq("user_id", profileId)
    .eq("node_id", nodeId)
    .maybeSingle();

  if (error) {
    if (isMissingCommunityTables(error)) return false;
    throw error;
  }

  return Boolean(data);
}

export async function reportCommunityNode(
  profileId: string,
  nodeId: string,
  reason: string,
  detail?: string,
) {
  const { error } = await supabase.from("vocabulary_reports").insert({
    reporter_id: profileId,
    node_id: nodeId,
    reason,
    detail: detail?.trim() || null,
  });

  if (error) {
    if (isMissingCommunityTables(error)) {
      throw new Error("Cần chạy migration community_saves_reports để bật Báo lỗi.");
    }
    throw error;
  }
}

async function fetchLegacyDeckNodes(profileId: string) {
  const { data, error } = await supabase
    .from("deck_stats")
    .select("*")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as Array<{
    deck_id: string;
    name: string;
    description: string | null;
    card_count: number;
    studied_count?: number;
    due_count?: number;
    created_at: string;
  }>).map((deck, index) => ({
    id: deck.deck_id,
    user_id: profileId,
    parent_id: null,
    title: deck.name,
    description: deck.description,
    type: "deck" as const,
    visibility: "private" as const,
    level: null,
    category: null,
    tags: [],
    order_index: index,
    created_at: deck.created_at,
    updated_at: deck.created_at,
    child_folder_count: 0,
    child_deck_count: 0,
    card_count: Number(deck.card_count ?? 0),
    total_card_count: Number(deck.card_count ?? 0),
    studied_count: Number(deck.studied_count ?? 0),
    due_count: Number(deck.due_count ?? 0),
    legacy_deck_id: deck.deck_id,
  }));
}

function isMissingVocabularyTree(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message) : "";
  const code = "code" in error ? String(error.code) : "";

  return (
    code === "42P01" ||
    message.includes("vocabulary_nodes") ||
    message.includes("vocabulary_node_stats") ||
    message.includes("Could not find the table") ||
    message.includes("schema cache")
  );
}

function isMissingCommunityTables(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message) : "";
  const code = "code" in error ? String(error.code) : "";

  return (
    code === "42P01" ||
    message.includes("vocabulary_saved_nodes") ||
    message.includes("vocabulary_reports") ||
    message.includes("Could not find the table") ||
    message.includes("schema cache")
  );
}
