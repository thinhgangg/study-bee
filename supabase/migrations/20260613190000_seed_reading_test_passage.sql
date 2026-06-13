-- Development seed: one published standalone Reading Passage 1.

insert into public.reading_passages (
  id,
  title,
  slug,
  content,
  topic,
  difficulty,
  estimated_time,
  source,
  is_published,
  published_at,
  passage_number,
  is_standalone
)
values (
  '10000000-0000-4000-8000-000000000001',
  'The Changing Role of Urban Libraries',
  'the-changing-role-of-urban-libraries',
  E'For much of their history, public libraries were mainly quiet buildings where people borrowed books and consulted reference materials. In many cities, however, that traditional role has expanded. Modern libraries are increasingly designed as flexible public spaces that support learning, technology and community life.\n\nOne reason for this change is the growth of digital information. As books, newspapers and academic resources became available online, some observers predicted that physical libraries would disappear. Instead, many libraries adapted. They introduced free internet access, digital catalogues and staff-led workshops that help visitors develop practical computer skills. These services are particularly valuable for people who cannot afford reliable technology at home.\n\nLibraries have also begun to provide facilities that were uncommon in the past. Some now contain recording studios, small business centres and rooms equipped with tools such as 3D printers. These areas are often called makerspaces because visitors can use them to design, repair or create things. Rather than simply receiving information, library users can apply what they learn to real projects.\n\nThe social function of libraries has become equally important. Urban residents may live close to thousands of people yet still experience isolation. Libraries offer indoor spaces where no purchase is required, making them accessible to students, older residents and families. Reading groups, language classes and public talks can help strangers form lasting connections.\n\nThis wider mission creates challenges. New technology is expensive, and staff need additional training to manage unfamiliar equipment and activities. Libraries must also balance lively group events with the needs of visitors who require silence. Successful buildings therefore use separate zones, careful scheduling and sound-reducing materials.\n\nDespite these difficulties, evidence from several cities suggests that redesigned libraries attract more visitors, not fewer. Their survival has depended less on protecting an old model than on understanding what local communities currently need. Books remain central, but they now sit within a much broader collection of services.',
  'Society & Education',
  6.0,
  15,
  'StudyBee Original',
  true,
  now(),
  1,
  true
)
on conflict (id) do update set
  title = excluded.title,
  slug = excluded.slug,
  content = excluded.content,
  topic = excluded.topic,
  difficulty = excluded.difficulty,
  estimated_time = excluded.estimated_time,
  source = excluded.source,
  is_published = excluded.is_published,
  published_at = excluded.published_at,
  passage_number = excluded.passage_number,
  is_standalone = excluded.is_standalone;

insert into public.reading_passage_sections (
  id, passage_id, label, content, order_index
)
values
  (
    '11000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'A',
    'For much of their history, public libraries were mainly quiet buildings where people borrowed books and consulted reference materials. In many cities, however, that traditional role has expanded. Modern libraries are increasingly designed as flexible public spaces that support learning, technology and community life.',
    0
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'B',
    'One reason for this change is the growth of digital information. As books, newspapers and academic resources became available online, some observers predicted that physical libraries would disappear. Instead, many libraries adapted. They introduced free internet access, digital catalogues and staff-led workshops that help visitors develop practical computer skills. These services are particularly valuable for people who cannot afford reliable technology at home.',
    1
  ),
  (
    '11000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'C',
    'Libraries have also begun to provide facilities that were uncommon in the past. Some now contain recording studios, small business centres and rooms equipped with tools such as 3D printers. These areas are often called makerspaces because visitors can use them to design, repair or create things. Rather than simply receiving information, library users can apply what they learn to real projects.',
    2
  ),
  (
    '11000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    'D',
    'The social function of libraries has become equally important. Urban residents may live close to thousands of people yet still experience isolation. Libraries offer indoor spaces where no purchase is required, making them accessible to students, older residents and families. Reading groups, language classes and public talks can help strangers form lasting connections.',
    3
  ),
  (
    '11000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    'E',
    'This wider mission creates challenges. New technology is expensive, and staff need additional training to manage unfamiliar equipment and activities. Libraries must also balance lively group events with the needs of visitors who require silence. Successful buildings therefore use separate zones, careful scheduling and sound-reducing materials.',
    4
  ),
  (
    '11000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000001',
    'F',
    'Despite these difficulties, evidence from several cities suggests that redesigned libraries attract more visitors, not fewer. Their survival has depended less on protecting an old model than on understanding what local communities currently need. Books remain central, but they now sit within a much broader collection of services.',
    5
  )
on conflict (id) do update set
  label = excluded.label,
  content = excluded.content,
  order_index = excluded.order_index;

insert into public.reading_questions (
  id, passage_id, question_group, order_index, question_type, prompt, explanation
)
values
  (
    '12000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Questions 1-2',
    0,
    'multiple_choice',
    'What is the main purpose of the passage?',
    'The passage explains how urban libraries have expanded beyond lending books and why this change matters.'
  ),
  (
    '12000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'Questions 1-2',
    1,
    'multiple_choice',
    'Why are digital services especially valuable to some library users?',
    'Paragraph B states that these services help people who cannot afford reliable technology at home.'
  ),
  (
    '12000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'Questions 3-5',
    2,
    'true_false_not_given',
    'Makerspaces allow visitors to use information in practical projects.',
    'Paragraph C says visitors can apply what they learn to real projects.'
  ),
  (
    '12000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    'Questions 3-5',
    3,
    'true_false_not_given',
    'All activities in modern libraries are free of charge.',
    'The passage says no purchase is required to use the indoor space, but it does not state that every activity is free.'
  ),
  (
    '12000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    'Questions 3-5',
    4,
    'true_false_not_given',
    'Redesigned libraries have caused visitor numbers to decline.',
    'Paragraph F says redesigned libraries attract more visitors, not fewer.'
  )
on conflict (id) do update set
  question_group = excluded.question_group,
  order_index = excluded.order_index,
  question_type = excluded.question_type,
  prompt = excluded.prompt,
  explanation = excluded.explanation;

insert into public.reading_question_options (
  id, question_id, option_key, option_text, order_index
)
values
  ('13000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 'A', 'To argue that printed books are no longer useful', 0),
  ('13000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-000000000001', 'B', 'To describe how and why urban libraries are changing', 1),
  ('13000000-0000-4000-8000-000000000003', '12000000-0000-4000-8000-000000000001', 'C', 'To compare library systems in different countries', 2),
  ('13000000-0000-4000-8000-000000000004', '12000000-0000-4000-8000-000000000001', 'D', 'To explain how to design a library building', 3),
  ('13000000-0000-4000-8000-000000000005', '12000000-0000-4000-8000-000000000002', 'A', 'They replace the need for trained library staff', 0),
  ('13000000-0000-4000-8000-000000000006', '12000000-0000-4000-8000-000000000002', 'B', 'They are only available in large cities', 1),
  ('13000000-0000-4000-8000-000000000007', '12000000-0000-4000-8000-000000000002', 'C', 'They support people without reliable technology at home', 2),
  ('13000000-0000-4000-8000-000000000008', '12000000-0000-4000-8000-000000000002', 'D', 'They make printed reference materials more expensive', 3),
  ('13000000-0000-4000-8000-000000000009', '12000000-0000-4000-8000-000000000003', 'TRUE', 'TRUE', 0),
  ('13000000-0000-4000-8000-000000000010', '12000000-0000-4000-8000-000000000003', 'FALSE', 'FALSE', 1),
  ('13000000-0000-4000-8000-000000000011', '12000000-0000-4000-8000-000000000003', 'NOT GIVEN', 'NOT GIVEN', 2),
  ('13000000-0000-4000-8000-000000000012', '12000000-0000-4000-8000-000000000004', 'TRUE', 'TRUE', 0),
  ('13000000-0000-4000-8000-000000000013', '12000000-0000-4000-8000-000000000004', 'FALSE', 'FALSE', 1),
  ('13000000-0000-4000-8000-000000000014', '12000000-0000-4000-8000-000000000004', 'NOT GIVEN', 'NOT GIVEN', 2),
  ('13000000-0000-4000-8000-000000000015', '12000000-0000-4000-8000-000000000005', 'TRUE', 'TRUE', 0),
  ('13000000-0000-4000-8000-000000000016', '12000000-0000-4000-8000-000000000005', 'FALSE', 'FALSE', 1),
  ('13000000-0000-4000-8000-000000000017', '12000000-0000-4000-8000-000000000005', 'NOT GIVEN', 'NOT GIVEN', 2)
on conflict (id) do update set
  option_key = excluded.option_key,
  option_text = excluded.option_text,
  order_index = excluded.order_index;

insert into public.reading_question_answers (id, question_id, answer_text)
values
  ('14000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 'B'),
  ('14000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-000000000002', 'C'),
  ('14000000-0000-4000-8000-000000000003', '12000000-0000-4000-8000-000000000003', 'TRUE'),
  ('14000000-0000-4000-8000-000000000004', '12000000-0000-4000-8000-000000000004', 'NOT GIVEN'),
  ('14000000-0000-4000-8000-000000000005', '12000000-0000-4000-8000-000000000005', 'FALSE')
on conflict (id) do update set answer_text = excluded.answer_text;

insert into public.reading_passage_vocabulary (
  id, passage_id, word, context_sentence
)
values
  (
    '15000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'flexible',
    'Modern libraries are increasingly designed as flexible public spaces that support learning, technology and community life.'
  ),
  (
    '15000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'makerspace',
    'These areas are often called makerspaces because visitors can use them to design, repair or create things.'
  ),
  (
    '15000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'isolation',
    'Urban residents may live close to thousands of people yet still experience isolation.'
  ),
  (
    '15000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    'redesigned',
    'Evidence from several cities suggests that redesigned libraries attract more visitors, not fewer.'
  )
on conflict (id) do update set
  word = excluded.word,
  context_sentence = excluded.context_sentence;
