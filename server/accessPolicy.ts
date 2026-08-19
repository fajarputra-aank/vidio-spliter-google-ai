export function hasUnlimitedTransforms(user: { role: string | null | undefined; unlimitedTransforms?: boolean | null }) {
  return user.role === "admin" || user.unlimitedTransforms === true;
}

export function hasUnlimitedHdExports(role: string | null | undefined) {
  return role === "admin";
}

export function hasUnlimitedCollaborationShareLinks(role: string | null | undefined) {
  return role === "admin";
}
