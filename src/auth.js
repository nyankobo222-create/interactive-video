export function getToken() {
  return localStorage.getItem("admin_token") || "";
}

export function logout() {
  localStorage.removeItem("admin_token");
  location.href = "/admin/login";
}

export function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}
