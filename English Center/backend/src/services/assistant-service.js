function normalizeTextForChat(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ä‘/g, 'd')
    .replace(/Ä/g, 'd')
    .toLowerCase();
}

function assistantFallbackReply(messages) {
  const last = messages.slice().reverse().find(item => item && item.role === 'user');
  const text = normalizeTextForChat(last ? last.content : '');
  let reply = 'Minh chua hieu ro cau hoi nay. Ban co the hoi ve khoa hoc, hoc phi, giao vien, lich hoc hoac dang ky de minh tu van nhanh hon.';
  if (text.includes('hoc phi') || text.includes('gia') || text.includes('phi')) {
    reply = 'Hoc phi tuy theo khoa hoc. Ban co the xem trang Hoc phi hoac noi muc tieu diem so, minh se goi y khoa phu hop.';
  } else if (text.includes('giao vien') || text.includes('teacher') || text.includes('thay') || text.includes('co ')) {
    reply = 'English Center co doi ngu giao vien luyen thi THPTQG theo tung muc tieu diem. Ban co the xem trang Giao vien de chon giao vien phu hop.';
  } else if (text.includes('dang ky') || text.includes('register') || text.includes('enroll')) {
    reply = 'Ban bam Dang Ky, tao tai khoan hoc sinh, sau do chon khoa hoc va xac nhan ghi danh. He thong se dua ban vao dashboard hoc sinh.';
  } else if (text.includes('test') || text.includes('trinh do') || text.includes('kiem tra')) {
    reply = 'TEST_START';
  } else if (text.includes('khoa') || text.includes('course')) {
    reply = 'English Center co cac khoa nen tang, luyen de, cap toc, tu vung, phat am AI va nang cao. Hay noi muc tieu diem hien tai de minh goi y.';
  }
  return reply;
}

function extractAssistantText(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (typeof data.reply === 'string') return data.reply;
  if (typeof data.text === 'string') return data.text;
  if (typeof data.message === 'string') return data.message;
  if (data.message && typeof data.message.content === 'string') return data.message.content;
  if (Array.isArray(data.content) && data.content[0] && typeof data.content[0].text === 'string') return data.content[0].text;
  if (Array.isArray(data.choices) && data.choices[0]) {
    return data.choices[0].message?.content || data.choices[0].text || '';
  }
  if (Array.isArray(data.candidates) && data.candidates[0]) {
    const parts = data.candidates[0].content?.parts || [];
    return parts.map(part => part.text || '').join('').trim();
  }
  return '';
}

async function callAssistantService(payload) {
  const url = process.env.ASSISTANT_API_URL || process.env.CHAT_API_URL || '';
  if (!url) return '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.ASSISTANT_API_TIMEOUT_MS || 12000));
  try {
    const headers = { 'Content-Type': 'application/json' };
    const key = process.env.ASSISTANT_API_KEY || process.env.CHAT_API_KEY || '';
    if (key) headers.Authorization = `Bearer ${key}`;
    if (process.env.ASSISTANT_API_HEADER_NAME && process.env.ASSISTANT_API_HEADER_VALUE) {
      headers[process.env.ASSISTANT_API_HEADER_NAME] = process.env.ASSISTANT_API_HEADER_VALUE;
    }
    const response = await fetch(url, {
      method: process.env.ASSISTANT_API_METHOD || 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Assistant service ${response.status}: ${text.slice(0, 200)}`);
    let data = text;
    try {
      data = JSON.parse(text);
    } catch {}
    return extractAssistantText(data);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  assistantFallbackReply,
  callAssistantService,
  extractAssistantText
};
