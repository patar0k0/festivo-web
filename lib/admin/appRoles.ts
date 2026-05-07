export const APP_ROLE_VALUES = ["user", "organizer", "admin", "super_admin"] as const;

export type AppRole = (typeof APP_ROLE_VALUES)[number];

export function isAppRoleValue(role: string): role is AppRole {
  return (APP_ROLE_VALUES as readonly string[]).includes(role);
}

export function isStaffAdminRole(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

export function appRoleLabelBg(role: AppRole): string {
  switch (role) {
    case "super_admin":
      return "Super админ";
    case "admin":
      return "Админ";
    case "organizer":
      return "Организатор";
    default:
      return "Потребител";
  }
}
