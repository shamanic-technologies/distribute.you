(function () {
  var pollingTimeout = 6000;
  var visitorIdKey = "Metadata_visitor_id";
  var cidKey = "metadata_cid";
  var nativeStructureKey = "md_nid";
  let cidHistory = [];
  const cidHistoryKey = "Metadata_cid_history";
  var formsSet = new Set();
  var blacklistSet = new Set(["hs_context"]);
  var log = { sentData: [], errors: [], formsSet };

  var opts = {
    adjustDataBeforeSend: (data) => data,
    allowOrigin: [],
    async: false,
    baseUrl: "https://platformapi.metadata.io",
    listenFormSubmit: true,
    onFormInit: () => {},
    primaryKey: "name",
    storedCidExpiresIn: 43200 // 30 days
  };

  /**
   * Get the value of a cookie.
   * @param {string} key - The key of the cookie.
   * @returns {string|undefined} The value of the cookie, or undefined if not found.
   */
  function getCookieValue(key) {
    var cookie = document.cookie.split("; ").find(function (cookie) {
      return cookie.indexOf(key) === 0;
    });

    if (cookie) {
      return cookie.substring(cookie.indexOf("=") + 1);
    }
  }

  /**
   * Create a cookie expiration date.
   * @param {number} minutes - The number of minutes until the cookie expires.
   * @returns {string} The expiration date as a GMT string.
   */
  function createCookieExpiration(minutes) {
    return new Date(new Date().getTime() + 1000 * 60 * minutes).toGMTString();
  }

  /**
   * Set the value of a cookie.
   * @param {string} key - The key of the cookie.
   * @param {string} value - The value to set.
   * @param {string} expiresIn - The number of minutes until the cookie expires.
   */
  function setCookieValue(key, value, expiresIn) {
    const params = [
      [key, value],
      ["expires", createCookieExpiration(expiresIn)],
      ["path", "/"]
    ];

    if (opts.domain) {
      params.push(["domain", opts.domain]);
    }

    document.cookie = params.map((pair) => pair.join("=")).join("; ");
  }

  function getUrlParameter(parameter, fallback) {
    var result = new RegExp("[\\?&]" + parameter + "=([^&#]*)").exec(
      window.location.search
    );

    return result === null
      ? fallback
      : decodeURIComponent(result[1].replace(/\+/g, " "));
  }

  function normalizeFormData(data) {
    var acc = {};

    if (!data) {
      return acc;
    }

    Object.entries(data).forEach(function (entry) {
      var key = entry[0];
      var value = entry[1];

      if (!blacklistSet.has(key)) {
        acc[key] = value;
      }
    });

    return acc;
  }

  function getFormData(formEl) {
    var data = {};
    var elements = formEl.querySelectorAll(
      "input[name]:not([type=password]):not([type=hidden]),select[name]"
    );

    Array.prototype.forEach.call(elements, function (e) {
      var key = e[opts.primaryKey] || e.name;
      data[key] = e.value;
    });

    return data;
  }

  function getAllFields() {
    var acc = [];

    formsSet.forEach(function (formEl) {
      acc = acc.concat(Object.keys(getFormData(formEl)));
    });

    return acc;
  }

  function sendData(sfv, callback) {
    var data = opts.adjustDataBeforeSend({
      account_id: opts.accountId,
      cid_history: cidHistory && cidHistory.length ? cidHistory : (() => {
        try {
          return JSON.parse(getCookieValue(cidHistoryKey)) || [];
        } catch (e) {
          return [];
        }
      })(),
      cid: getUrlParameter("cid"),
      lpu: window.location.href,
      metadata_cid: getUrlParameter(cidKey, getCookieValue(cidKey)),
      md_nid: getUrlParameter(nativeStructureKey, getCookieValue(nativeStructureKey)),
      sfv: normalizeFormData(sfv),
      url_referrer: window.document.referrer,
      visitor_id: getCookieValue(visitorIdKey)
    });

    var xhr = new XMLHttpRequest();

    // TODO: consider using fetch api with "keepalive: true"
    // when it's widely supported instead of sync request
    xhr.open("POST", opts.baseUrl + "/insight", opts.async);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status <= 299) {
        callback && callback();
      }
    };

    xhr.send(JSON.stringify(data));
    log.sentData.push(data);
  }

  function sendFormData(formEl, callback) {
    sendData(getFormData(formEl), callback);
  }

  function listenHubspotCallback() {
    var interval;
    var handler = function () {
      if (window.hubspot) {
        var onMessage = function (e) {
          if (
            e.data.type === "hsFormCallback" &&
            e.data.eventName === "onFormSubmit"
          ) {
            sendData(
              e.data.data.reduce(function (acc, field) {
                acc[field.name] = field.value;
                return acc;
              }, {})
            );
          }
        };

        window.addEventListener("message", onMessage, false);
        window.clearTimeout(interval);
      } else if (window.HubspotFormsV4) {
          window.addEventListener(
            "hs-form-event:on-submission:success",
            (e) => {
              var instanceId = e.detail.instanceId;
              var formId = e.detail.formId;
              var forms = window.HubspotFormsV4.getForms();

              var form = forms.find(form => form.getInstanceId() === instanceId && form.getFormId() === formId);
              if (form) {
                form.getFormFieldValues().then(data => {
                  const formData = {};
                  data.forEach(item => {
                    formData[item.name] = item.value;
                  });
                  sendData(formData);
                })
              }
            }
          );
          window.clearTimeout(interval);
      }
    };

    interval = window.setInterval(handler, pollingTimeout);
    handler();
  }

  function listenHubspotCalendarCallback() {
    var callback = function (e) {
      if (e.data && e.data.meetingBookSucceeded) {
        sendData(e.data.meetingsPayload.bookingResponse.postResponse.contact);
      }
    };

    window.addEventListener("message", callback);
  }

  function listenMarketoCallback() {
    var interval;
    var handler = function () {
      if (window.MktoForms2 && window.MktoForms2.whenReady) {
        var onReady = function (form) {
          form.onSuccess(function () {
            sendFormData(form.getFormElem().get(0));
          });
        };

        window.MktoForms2.whenReady(onReady);
        window.clearTimeout(interval);
      }
    };

    interval = window.setInterval(handler, pollingTimeout);
    handler();
  }

  function listenDriftCallback() {
    var interval;
    var handler = function () {
      if (window.drift && window.drift.on) {
        var onEmailCapture = function (e) {
          sendData({ email: e.data.email });
        };

        window.drift.on("emailCapture", onEmailCapture);
        window.clearTimeout(interval);
      }
    };

    interval = window.setInterval(handler, pollingTimeout);
    handler();
  }

  function listenQualifiedCallback() {
    var interval;
    var capturedEmail;

    var handler = function () {
      if (window.qualified) {
        var callback = function (name, data) {
          if (
            (name === "Email Captured" || name === "Meeting Booked") &&
            capturedEmail !== data.field_values.email
          ) {
            sendData(data.field_values);
            capturedEmail = data.field_values.email;
          }
        };

        window.qualified("handleEvents", callback);
        window.clearTimeout(interval);
      }
    };

    interval = window.setInterval(handler, pollingTimeout);
    handler();
  }

  function listenPardotIframeFormCallback() {
    var callback = function (e) {
      if (opts.allowOrigin.includes(e.origin) && e.data) {
        var data;

        try {
          data = JSON.parse(e.data);
        } catch (e) {
          data = {};
        }

        if (data.event === "ContactUsCallback") {
          sendData(data, function () {
            e.source.postMessage("SendDataCallback", e.origin);

            if (data.redirectUrl) {
              location.href = data.redirectUrl;
            }
          });
        }
      }
    };

    window.addEventListener("message", callback);
  }

  function submitHandler(e) {
    var form = e.target;
    var id = form.getAttribute("id") || "";

    if (
      id.search("hsForm_") === 0 ||
      (window.MktoForms2 &&
        window.MktoForms2.allForms().some((form) => id.includes(form.getId())))
    ) {
      return;
    }

    sendData(getFormData(form));
  }

  function initForm(el) {
    if (formsSet.has(el)) {
      return;
    }

    if (opts.listenFormSubmit) {
      el.addEventListener("submit", submitHandler);
    }

    formsSet.add(el);
    opts.onFormInit(el);
  }

  function observer(mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.tagName === "FORM") {
          initForm(node);
        } else if (node.querySelectorAll) {
          Array.prototype.forEach.call(node.querySelectorAll("form"), initForm);
        }
      });
    });
  }

  function storeCid() {
    // Handle metadata_cid
    const cid = getUrlParameter(cidKey);

    if (cid && !getCookieValue(cidKey)) {
      setCookieValue(cidKey, cid, opts.storedCidExpiresIn);
    }

    // Handle md_nid
    const nid = getUrlParameter(nativeStructureKey);

    if (cid) {
      if (nid) {
        setCookieValue(nativeStructureKey, nid, opts.storedCidExpiresIn);
      } else {
        setCookieValue(nativeStructureKey, "", -1);
      }
    }

    // If no cid, no need to update history
    if (!cid) {
      return;
    }

    if (!getCookieValue(cidKey)) {
      setCookieValue(cidKey, cid, opts.storedCidExpiresIn);
    }

    // Store cid history
    const storedCidHistory = getCookieValue(cidHistoryKey);

    try {
      cidHistory = JSON.parse(storedCidHistory);
    } catch (e) {
      cidHistory = [];
    }

    // Update landing page URL on each new cid visit (last-touch attribution)
    // This ensures we capture the URL from the ad that drove the conversion
    cidHistory = cidHistory.filter((item) => item.lpu === undefined);
    cidHistory.push({ lpu: window.location.href });

    const index = cidHistory.findIndex((item) => item.cid === cid);
    const createdDate = new Date().toISOString();

    if (index === -1) {
      cidHistory.push({ cid, createdDate: createdDate });
    } else {
      cidHistory[index].createdDate = createdDate;
    }

    setCookieValue(
      cidHistoryKey,
      JSON.stringify(cidHistory),
      129600 // 90 days
    );
  }

  function registerAllFieldsCallback() {
    const type = "METADATA_GET_ALL_FIELDS";
    const allowedOriginPattern = /^https:\/\/([a-zA-Z0-9-]+\.)?metadata\.io$/;

    window.addEventListener("message", function (event) {
      if (!allowedOriginPattern.test(event.origin)) {
        return;
      }

      if (event.data && event.data.type === type) {
        event.source.postMessage(
          { type: type, fields: getAllFields() },
          event.origin
        );
      }
    });
  }

  function init(options) {
    Object.assign(opts, options);

    if (options.initForms !== false) {
      listenHubspotCallback();
      listenHubspotCalendarCallback();
      listenMarketoCallback();
      listenDriftCallback();
      listenQualifiedCallback();
      listenPardotIframeFormCallback();

      Array.prototype.forEach.call(
        window.document.querySelectorAll("form"),
        initForm
      );

      new MutationObserver(observer).observe(window.document.body, {
        childList: true,
        subtree: true
      });
    }

    if (options.onReady) {
      options.onReady();
    }

    storeCid();
    registerAllFieldsCallback();
  }

  window.Metadata = window.Metadata || {};
  window.Metadata.siteScript = {
    init,
    sendData,
    sendFormData,
    getAllFields,
    log
  };
})();
