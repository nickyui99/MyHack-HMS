import { config } from "../config.js";

export function currentUser(req, res, next) {
  const iapEmail = req.header("x-goog-authenticated-user-email");
  if (iapEmail) {
    req.userEmail = iapEmail.replace("accounts.google.com:", "");
    return next();
  }

  if (!config.iapRequired) {
    req.userEmail = req.header("x-carelink-local-user") || config.localUserEmail;
    return next();
  }

  return res.status(401).json({ detail: "Missing IAP authenticated user header" });
}
