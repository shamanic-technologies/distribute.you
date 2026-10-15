console.log("[Noble] Noble script loaded 2.0.8");

const BANNER_EXPANDED_HEIGHT = 304;
const BANNER_INITIAL_HEIGHT = 88;

const BANNER_EXPANDED_HEIGHT_STR = BANNER_EXPANDED_HEIGHT + 'px';
const BANNER_INITIAL_HEIGHT_STR = BANNER_INITIAL_HEIGHT + 'px';

let wasBannerOnPrevPage;
let wasBannerExpandedOnPrevPage;

const getNobleIframePostition = () => {
	const nobleIframe = document.getElementById("nobleIframe");
	const style = window.getComputedStyle(nobleIframe);
	
	return style.getPropertyValue("position");
}

/**
 * Check if an element is sticky or fixed; and has a top position.
 */
const checkIsTopFixedElement = (computedStyle) => {
	let isTopFixedElement = false;
	const top = computedStyle.top;
	const bottom = computedStyle.bottom;

	if (
		computedStyle.position === "fixed" ||
		computedStyle.position === "sticky"
	) {
		if (bottom === "auto") isTopFixedElement = true;
		else isTopFixedElement = parseFloat(top) < parseFloat(bottom);
	}

	return isTopFixedElement;
};


const adjustPageContent = (newHeightStr, heightDiff) => {
	const nobleIframePosition = getNobleIframePostition()
	if (nobleIframePosition== 'fixed') {

		const allElements = document.querySelectorAll("*");

		if (document.body.style.marginTop != newHeightStr) {
			adjustBannerHeight(newHeightStr)
			allElements.forEach((element) => {
				const computedStyle = getComputedStyle(element);

				if (element.id === "nobleIframe") return;
				if (checkIsTopFixedElement(computedStyle)) {
					const currentTop = parseInt(computedStyle.top) || 0;
					element.style.top = currentTop + heightDiff + "px";
				}
			});
		}
	} else {
		console.log(`Noble Iframe Position is ${nobleIframePosition}. Skipping page content adjustment.`)
		adjustBannerHeight(newHeightStr)
	}
};

const adjustBannerHeight = (newHeightStr) => {
	const nobleIframe = document.getElementById("nobleIframe");
	if (nobleIframe)
		nobleIframe.style.height = newHeightStr;
};

/**
 * Adjust page content for initial, expanded, and collapsed banner
 * */
const adjustPageContentInitialBanner = () => {
	adjustPageContent(BANNER_INITIAL_HEIGHT_STR, BANNER_INITIAL_HEIGHT);
};


const adjustPageContentExpandedBanner = () => {
	let heightDiff = BANNER_EXPANDED_HEIGHT - BANNER_INITIAL_HEIGHT;
	adjustPageContent(BANNER_EXPANDED_HEIGHT_STR, heightDiff);
};

const adjustPageContentCollapseBanner = () => {
	let heightDiff = BANNER_EXPANDED_HEIGHT - BANNER_INITIAL_HEIGHT;
	adjustPageContent(BANNER_INITIAL_HEIGHT_STR, -heightDiff);
};


/** Expand and collapse embedded banner**/

const initialEmbeddedBanner = () => {
	adjustBannerHeight(BANNER_INITIAL_HEIGHT_STR);
};


const expandEmbeddedBanner = () => {
	adjustBannerHeight(BANNER_EXPANDED_HEIGHT_STR);
};


/**Remove banner for distributor pages without Noble**/
const removeCollapsedBanner = () => {
	adjustPageContent("0px", -BANNER_INITIAL_HEIGHT);
};

const removeExpandedBanner = () => {
	adjustPageContent("0px", -BANNER_EXPANDED_HEIGHT);
};



/**
 * Executed on page load
 */
window.addEventListener("load", () => {
	let nobleIframe = document.getElementById("nobleIframe");

	if (nobleIframe) {
		nobleIframe.style.display = "block"; //Force widget to be displayed on mobile devices.
	}
});


/**
 * Check for the iframe on navigation. Revert margins if not there.
 */
(function () {
	const originalPushState = history.pushState;
	const originalReplaceState = history.replaceState;

	function checkForNoble() {
		// Create a MutationObserver to wait for the DOM to update
		const observer = new MutationObserver((mutations, obs) => {
			const nobleIframe = document.getElementById("nobleIframe");

			if (nobleIframe) {
				//console.log("[Noble] nobleIframe exists.");
				//obs.disconnect(); // Stop observing once the iframe is found
			} else if (wasBannerOnPrevPage) {
				console.log(
					"[Noble] nobleIframe was not found on current page. Reverting margins."
				);

				if (wasBannerExpandedOnPrevPage) removeExpandedBanner();
				else removeCollapsedBanner();

				document.body.style.marginTop = "0";


				wasBannerOnPrevPage = false;
				obs.disconnect();
			}
		});

		// Start observing the document for changes
		observer.observe(document.body, {
			childList: true, // Observe direct children
			subtree: true, // Observe all descendants
		});
	}

	history.pushState = function (...args) {
		originalPushState.apply(this, args);
		checkForNoble();
	};

	/*history.replaceState = function (...args) {
		originalReplaceState.apply(this, args);
		checkForNoble();
	}*/

	window.addEventListener("popstate", function () {
		checkForNoble();
	});
})();



/**
 * Executed on iframe message post
 */
window.addEventListener("message", function (event) {
	const trustedOrigins = [
		"https://app-staging.v2.thatsnoble.com",
		"https://app.v2.thatsnoble.com"
	];
	const allowedNavigationDomains = [
		"https://dimmo.ai",
		"https://www.dimmo.ai",
		"https://webapp-git-noble-integration-lucas-swartsenburgs-projects.vercel.app",
	];

	// Check if the event.origin is in the list of trusted origins
	if (trustedOrigins.includes(event.origin)) {

		// check if banner is embedded; assume not if not defined
		const isEmbedded = event.data.embedded ? event.data.embedded : false;


		/**
		 * Message to get URL where the widget is embedded
		 */

		if (event.data === "getURL") {
			const iframeURL = window.location.href;
			event.source.postMessage({ iframeURL: iframeURL }, event.origin);
		}

		const nobleIframePosition = getNobleIframePostition()

		/**
		 * Message to:
		 * - Change the positions of the top fixed/sticky elements
		 * - Change the whole document body position
		 */
		if (event.data.bannerVisibility === "bannerLoaded") {

			const nobleIframe = document.getElementById("nobleIframe");
			nobleIframe.style.top = "0px";
			nobleIframe.style.width = "100%"
			nobleIframe.style.border = "none"
			if (isEmbedded) {
				initialEmbeddedBanner();
			} else if (wasBannerExpandedOnPrevPage) {
				adjustPageContentCollapseBanner();
				if (nobleIframePosition == 'fixed') document.body.style.marginTop = BANNER_INITIAL_HEIGHT_STR;
				wasBannerOnPrevPage = true
				wasBannerExpandedOnPrevPage = false
			} else {
				adjustPageContentInitialBanner()
				if (nobleIframePosition == 'fixed') document.body.style.marginTop = BANNER_INITIAL_HEIGHT_STR;
				wasBannerOnPrevPage = true
				wasBannerExpandedOnPrevPage = false
			}
		}

		if (event.data.bannerVisibility === "bannerExpanded") {
			if (isEmbedded) {
				expandEmbeddedBanner();
			} else {
				adjustPageContentExpandedBanner()
				if (nobleIframePosition == 'fixed') document.body.style.marginTop = BANNER_EXPANDED_HEIGHT_STR;
				wasBannerExpandedOnPrevPage = true
			}
		}

		if (event.data.bannerVisibility === "bannerCollapsed") {
			if (isEmbedded) {
				initialEmbeddedBanner();
			} else {
				adjustPageContentCollapseBanner()
				if (nobleIframePosition == 'fixed') document.body.style.marginTop = BANNER_INITIAL_HEIGHT_STR;
				wasBannerExpandedOnPrevPage = false;
			}
		}


		/**
		 * Message to redirect parent url
		 */
		if (event.data.parentUrl) {
			const url = new URL(event.data.parentUrl);

			// Check if the URL's origin matches the allowed domains
			if (allowedNavigationDomains.includes(url.origin)) {
				// Redirect safely
				window.location.href = url.href;
			} else {
				console.warn("Untrusted URL origin, skipping navigation:", url.origin);
			}
		}
	} else {
		//Log the case where the origin is not trusted
		// console.warn("Message received from an untrusted origin:", event.origin);
	}
});