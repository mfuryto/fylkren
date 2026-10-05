export function roleDisplayName(
  role: { name: string; isLeader: boolean },
  localizedLeader: string,
  language: string,
) {
  if (!role.isLeader) return role.name;
  return localizedLeader.length === 0
    ? role.name
    : localizedLeader[0].toLocaleUpperCase(language) + localizedLeader.slice(1);
}
