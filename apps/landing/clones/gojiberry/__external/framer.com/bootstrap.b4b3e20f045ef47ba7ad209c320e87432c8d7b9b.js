var _a, _b;
const hostInfo = {
	version: "1357c82",
	scopeCanvas: JSON.parse("true"),
};
const projectIdRegex = /^\/projects\/(?<prefix>(?:(?:[A-Za-z0-9]+-)*[A-Za-z0-9]+--)?)(?<id>[A-Za-z0-9]{20})(?<accessToken>(?:-[A-Za-z0-9]+)?)/;
const projectMatch = location.pathname.match(projectIdRegex);
const projectId = (_a = projectMatch === null || projectMatch === void 0 ? void 0 : projectMatch.groups) === null || _a === void 0 ? void 0 : _a.id;
const projectAccessToken = ((_b = projectMatch === null || projectMatch === void 0 ? void 0 : projectMatch.groups) === null || _b === void 0 ? void 0 : _b.accessToken) || undefined;
let canvas = "https://framercanvas.com";
if (projectId && hostInfo.scopeCanvas) {
	canvas = canvas.replace("//", `//project-${projectId.toLowerCase()}.`);
}
const bootstrap = {
	services: {
		api: "https://api.framer.com",
		app: "/__external/framer.com",
		canvas,
		events: "https://events.framer.com",
		login: "/__external/framer.com/login",
		userContent: "/__external/framerusercontent.com",
		modulesCDN: "/__external/framerusercontent.com/modules",
		modulesShortLink: "/__external/framer.com/m",
		previewDomain: "framer.app",
	},
	hostInfo: {
		version: hostInfo.version,
	},
};
if (projectId) {
	bootstrap.project = { id: projectId, accessToken: projectAccessToken };
}
Object.freeze(bootstrap);
window.bootstrap = bootstrap;
