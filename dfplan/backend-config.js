// Public Firebase web configuration only. Never put an Admin SDK private key here.
// Keep disabled until Google sign-in, Firestore rules and the owner are configured.
export const backendConfig = Object.freeze({
  enabled: false,
  projectKey: "wu-family",
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    appId: "",
  },
});
