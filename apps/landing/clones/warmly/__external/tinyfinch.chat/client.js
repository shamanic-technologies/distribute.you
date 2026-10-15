window.tinyChat = {};
window._tc_window = {
    CustomEvent: window.CustomEvent,
};

if (!customElements.get("tiny-chat")) {
    class TinyChatElement extends HTMLElement {
        constructor() {
            super();
            const shadow = this.attachShadow({ mode: "open" });

            const cssTemplate = document.getElementById("css-for-tiny-chat");
            if (cssTemplate) {
                const content =
                    cssTemplate.tagName == "TEMPLATE"
                        ? cssTemplate.content.cloneNode(true)
                        : cssTemplate;
                shadow.appendChild(content);
            }

            function getLocalStorageWithExpiration(name) {
                const raw = localStorage.getItem(name);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (new Date(parsed.expiration) <= new Date()) {
                    localStorage.removeItem(name);
                    return null;
                }
                return parsed.data;
            }

            const originalScript = document.getElementById("7a4696e");
            const profile = originalScript.getAttribute("data-profile");
            const teamID = originalScript.getAttribute("data-t");
            const cookie_chat_id = `chat-id-for-${teamID}-${profile}`;
            const chatID = getLocalStorageWithExpiration(cookie_chat_id);
            const locale = navigator.language ?? "en";

            const script = document.createElement("script");

            script.textContent = `
            fetch(
                '/__external/tinyfinch.chat/api/widget/?team=${teamID}&chat=${chatID}&locale=${locale}&profile=${profile}',
                    {
                        headers: {'Script-Origin': '${window.location.hostname}'}
                    }
                ).then(
                async (resp) => {
                    if (resp.ok) {return resp.text();} 
                    else {
                        text = await resp.text(); 
                        var message = 'An error occured when initializing Tiny Finch';
                        if (text == 'invalid_team') {message = 'We did not find your team with ID ${teamID}'};
                        if (text == 'invalid_subscription') {message = 'Your subscription is not active'};
                        if (text == 'url_in_black_list') {message = 'You have black listed this url'};
                        if (text == 'url_not_in_white_list') {message = 'You have not white listed this url'};
                        if (text == 'wrong_origin') {message = 'This origin is not in your authorized domains list, you can visit your dashboard Team page if you want to add some domains'};
                        throw message + ', please contact us at contact@tinyfinch.chat' ;
                    }
                }
                ).then(
                    (text) => {
                        const shadowRoot = document.querySelector('tiny-chat').shadowRoot;
                        const firstScript = shadowRoot.querySelector("script");
                        if (firstScript) {
                            firstScript.remove();
                        }
                        shadowRoot.innerHTML += text;
                        // Find and execute scripts within the fetched HTML
                        const scripts = shadowRoot.querySelectorAll('script[data-info="toload"]');
                        scripts.forEach(script => {
                            const newScript = document.createElement('script');
                            newScript.textContent = script.textContent;
                            script.parentNode.replaceChild(newScript, script);
                        });
            })`;
            this.shadowRoot.appendChild(script);
        }
    }

    customElements.define("tiny-chat", TinyChatElement);
}

function appendTinyChatElement() {
    if (!document.body.querySelector("tiny-chat")) {
        const containerDiv = document.createElement("div");
        containerDiv.style.position = "fixed";
        containerDiv.style.zIndex = "99999";
        containerDiv.style.bottom = "16px";
        containerDiv.style.right = "16px";
        const tinyChatElement = document.createElement("tiny-chat");
        containerDiv.appendChild(tinyChatElement);
        document.body.appendChild(containerDiv);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    appendTinyChatElement();
});

if (document.readyState == "complete") {
    appendTinyChatElement();
}
