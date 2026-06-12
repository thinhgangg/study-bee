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
  cloned_from_node_id?: string | null;
  cloned_from_title?: string | null;
  cloned_from_user_id?: string | null;
  cloned_from_author_label?: string | null;
  child_folder_count: number;
  child_deck_count: number;
  card_count: number;
  total_card_count: number;
  save_count?: number;
  saved_by_me?: boolean;
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

export async function fetchCommunityNodes(
  parentId: string | null,
  profileId?: string | null,
) {
  const query = supabase
    .from("vocabulary_node_stats")
    .select("*")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: false });

  const { data, error } = parentId
    ? await query.eq("parent_id", parentId)
    : await query.is("parent_id", null);

  if (!error && data) {
    const nodes = data as VocabularyNode[];

    const { data: visibleTree, error: treeError } = await supabase
      .from("vocabulary_nodes")
      .select("id, parent_id, type, visibility");

    if (treeError) throw treeError;

    const treeNodes = (visibleTree ?? []) as Array<{
      id: string;
      parent_id: string | null;
      type: VocabularyNodeType;
      visibility: VocabularyVisibility;
    }>;
    const treeById = new Map(treeNodes.map((node) => [node.id, node]));
    const effectiveVisibilityById = new Map<string, VocabularyVisibility>();

    function getEffectiveNodeVisibility(nodeId: string): VocabularyVisibility {
      const cached = effectiveVisibilityById.get(nodeId);
      if (cached) return cached;

      const lineage: VocabularyVisibility[] = [];
      const visited = new Set<string>();
      let current = treeById.get(nodeId);

      while (current && !visited.has(current.id)) {
        visited.add(current.id);
        lineage.push(current.visibility);
        current = current.parent_id ? treeById.get(current.parent_id) : undefined;
      }

      const effective = getVisibilityLimit(
        lineage.map((visibility) => ({ visibility })),
      );
      effectiveVisibilityById.set(nodeId, effective);
      return effective;
    }

    const foldersWithPublicDecks = new Set<string>();

    for (const deck of treeNodes.filter(
      (node) =>
        node.type === "deck" &&
        getEffectiveNodeVisibility(node.id) === "public",
    )) {
      let currentParentId = deck.parent_id;
      const visited = new Set<string>();

      while (currentParentId && !visited.has(currentParentId)) {
        visited.add(currentParentId);
        foldersWithPublicDecks.add(currentParentId);
        currentParentId = treeById.get(currentParentId)?.parent_id ?? null;
      }
    }

    const publicNodes = nodes.filter(
      (node) =>
        getEffectiveNodeVisibility(node.id) === "public" &&
        (node.type === "deck" || foldersWithPublicDecks.has(node.id)),
    );

    if (!profileId) return resetNodesProfileProgress(publicNodes);
    return enrichNodesWithProfileProgress(publicNodes, profileId);
  }
  if (isMissingVocabularyTree(error)) return [];
  throw error;
}

export function getVisibilityLimit(
  ancestors: Array<Pick<VocabularyNode, "visibility">>,
): VocabularyVisibility {
  if (ancestors.some((node) => node.visibility === "private")) return "private";
  if (ancestors.some((node) => node.visibility === "unlisted")) return "unlisted";
  return "public";
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

  const enrichedNodes = await enrichNodesWithProfileProgress(
    ((nodes ?? []) as VocabularyNode[]).map((node) => ({
      ...node,
      saved_by_me: true,
      saved_at: savedAtByNodeId.get(node.id) ?? node.created_at,
    })),
    profileId,
  );

  return enrichedNodes
    .map((node) => ({
      ...node,
      saved_by_me: true,
      saved_at: savedAtByNodeId.get(node.id) ?? node.created_at,
    }))
    .sort((left, right) =>
      String((right as VocabularyNode & { saved_at?: string }).saved_at).localeCompare(
        String((left as VocabularyNode & { saved_at?: string }).saved_at),
      ),
    );
}

async function enrichNodesWithProfileProgress(
  nodes: Array<VocabularyNode & { saved_at?: string }>,
  profileId: string,
) {
  if (nodes.length === 0) return nodes;

  const { data: treeData, error: treeError } = await supabase
    .from("vocabulary_nodes")
    .select("id, parent_id, type")
    .eq("visibility", "public");

  if (treeError) return nodes;

  const treeNodes = (treeData ?? []) as Array<{
    id: string;
    parent_id: string | null;
    type: VocabularyNodeType;
  }>;
  const childrenByParentId = new Map<string, typeof treeNodes>();

  for (const treeNode of treeNodes) {
    if (!treeNode.parent_id) continue;
    const siblings = childrenByParentId.get(treeNode.parent_id) ?? [];
    siblings.push(treeNode);
    childrenByParentId.set(treeNode.parent_id, siblings);
  }

  function collectDeckIds(nodeId: string): string[] {
    const node = treeNodes.find((item) => item.id === nodeId);
    if (!node) return [];
    if (node.type === "deck") return [node.id];

    return (childrenByParentId.get(node.id) ?? []).flatMap((child) =>
      collectDeckIds(child.id),
    );
  }

  const deckIdsByNodeId = new Map(
    nodes.map((node) => [node.id, collectDeckIds(node.id)]),
  );
  const deckIds = [...new Set([...deckIdsByNodeId.values()].flat())];
  if (deckIds.length === 0) return nodes;

  const { data: cardData, error: cardError } = await supabase
    .from("cards")
    .select("id, deck_id")
    .in("deck_id", deckIds);

  if (cardError) return nodes;

  const cards = (cardData ?? []) as Array<{ id: string; deck_id: string }>;
  const cardIds = cards.map((card) => card.id);
  if (cardIds.length === 0) {
    return nodes.map((node) => ({
      ...node,
      studied_count: 0,
      due_count: 0,
    }));
  }

  const { data: reviewData, error: reviewError } = await supabase
    .from("card_reviews")
    .select("card_id, reviewed_at, next_review_at")
    .eq("user_id", profileId)
    .in("card_id", cardIds);

  if (reviewError) return nodes;

  const reviewsByCardId = new Map(
    ((reviewData ?? []) as Array<{
      card_id: string;
      reviewed_at: string | null;
      next_review_at: string | null;
    }>).map((review) => [review.card_id, review]),
  );
  const now = new Date();

  return nodes.map((node) => {
    const nodeDeckIds = new Set(deckIdsByNodeId.get(node.id) ?? []);
    const nodeCards = cards.filter((card) => nodeDeckIds.has(card.deck_id));
    const studiedCount = nodeCards.filter(
      (card) => reviewsByCardId.get(card.id)?.reviewed_at,
    ).length;
    const dueCount = nodeCards.filter((card) => {
      const nextReviewAt = reviewsByCardId.get(card.id)?.next_review_at;
      return nextReviewAt ? new Date(nextReviewAt) <= now : false;
    }).length;

    return {
      ...node,
      card_count: node.type === "deck" ? nodeCards.length : node.card_count,
      total_card_count: nodeCards.length,
      studied_count: studiedCount,
      due_count: dueCount,
    };
  });
}

function resetNodesProfileProgress<T extends VocabularyNode>(nodes: T[]) {
  return nodes.map((node) => ({
    ...node,
    studied_count: 0,
    due_count: 0,
  }));
}

export async function fetchSavedNodeIds(profileId: string) {
  const { data, error } = await supabase
    .from("vocabulary_saved_nodes")
    .select("node_id")
    .eq("user_id", profileId);

  if (error) {
    if (isMissingCommunityTables(error)) return new Set<string>();
    throw error;
  }

  return new Set(((data ?? []) as Array<{ node_id: string }>).map((row) => row.node_id));
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
    .select("id, parent_id, title, visibility")
    .eq("user_id", profileId)
    .eq("type", "folder")
    .order("title", { ascending: true });

  if (!error && data) {
    return data as Pick<
      VocabularyNode,
      "id" | "parent_id" | "title" | "visibility"
    >[];
  }
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

  const existing = await fetchNode(nodeId);
  if (!existing || existing.user_id !== profileId) {
    throw new Error("Không tìm thấy thư mục hoặc bộ từ.");
  }

  const { error } = await supabase
    .from("vocabulary_nodes")
    .update({
      parent_id: parentId,
      updated_at: new Date().toISOString(),
    })
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
  const { data, error } = await supabase.rpc("copy_vocabulary_node_tree", {
    source_node_id: nodeId,
    target_user_id: profileId,
    target_parent_id: parentId,
  });

  if (error) {
    const missingRpc = error.code === "PGRST202" || error.code === "42883";
    if (isUnavailableCommunityNode(error)) {
      throw new Error("Bộ từ này không còn ở chế độ công khai và không thể lưu/sao chép.");
    }
    throw new Error(
      missingRpc
        ? "Supabase chưa nhận RPC copy_vocabulary_node_tree. Hãy chạy lại migration và reload schema cache."
        : `Không thể sao chép: ${error.message}${error.code ? ` (${error.code})` : ""}`,
    );
  }

  if (typeof data !== "string") {
    throw new Error("Không nhận được mã của bản sao vừa tạo.");
  }

  return data;
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
    if (isUnavailableCommunityNode(error)) {
      throw new Error("Bộ từ này không còn ở chế độ công khai và không thể lưu/sao chép.");
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

function isUnavailableCommunityNode(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message) : "";
  const code = "code" in error ? String(error.code) : "";

  return (
    code === "P0001" ||
    code === "23503" ||
    code === "42501" ||
    message.includes("Source node is not effectively public or does not exist") ||
    message.includes("violates row-level security policy") ||
    message.includes("vocabulary_saved_nodes_node_id_fkey")
  );
}
