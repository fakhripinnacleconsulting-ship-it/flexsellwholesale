/**
 * Manager Attribution Engine
 * Resolves loose salesperson strings, email addresses, or createdBy objects to a canonical Manager account.
 */

export interface CanonicalManager {
  _id: string;
  name: string;
  email: string;
}

export function isManagerMatch(manager: CanonicalManager, identifier?: any): boolean {
  if (!identifier) return false;

  // Handle object input (e.g. createdBy: { userId, name, email })
  if (typeof identifier === "object") {
    if (identifier.userId && String(identifier.userId) === String(manager._id)) return true;
    if (identifier.email && identifier.email.toLowerCase() === manager.email.toLowerCase()) return true;
    if (identifier.name && isManagerMatch(manager, identifier.name)) return true;
  }

  if (typeof identifier !== "string") return false;
  const target = identifier.trim().toLowerCase();
  if (!target) return false;

  const mgrId = String(manager._id).toLowerCase();
  const mgrEmail = manager.email.toLowerCase();
  const mgrName = manager.name.toLowerCase();

  // 1. Exact ID or Email match
  if (target === mgrId || target === mgrEmail) return true;

  // 2. Email prefix match (e.g. "manager" from manager@example.com)
  const emailPrefix = mgrEmail.split("@")[0];
  if (emailPrefix.length >= 2 && target === emailPrefix) return true;

  // 3. Name exact or substring match
  if (target === mgrName) return true;
  if (mgrName.includes(target) && target.length >= 2) return true;
  if (target.includes(mgrName) && mgrName.length >= 2) return true;

  // 4. Tokenized word match (e.g. "test" matching "Test Manager")
  const mgrTokens = mgrName.split(/\s+/).filter(t => t.length >= 2);
  const targetTokens = target.split(/\s+/).filter(t => t.length >= 2);

  for (const tt of targetTokens) {
    for (const mt of mgrTokens) {
      if (tt === mt || mt.startsWith(tt) || tt.startsWith(mt)) return true;
    }
  }

  return false;
}
