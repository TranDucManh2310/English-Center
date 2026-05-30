(function() {
  "use strict";

  const core = window.EC_ADMIN_CORE;
  if (!core) return;

  function hookSpaNav() {
    const original = window.spaNav;
    if (typeof original !== "function" || original.__opsHooked) return;
    const hooked = function(tabKey, sectionId) {
      const result = original.apply(this, arguments);
      setTimeout(() => core.renderActive(sectionId || tabKey), 220);
      return result;
    };
    hooked.__opsHooked = true;
    window.spaNav = hooked;
  }

  Object.assign(window.EC_ADMIN_OPS, {
    refresh: () => core.loadAll(false)
  });

  core.ready(() => {
    hookSpaNav();
    core.loadAll(true);
    setInterval(() => core.loadAll(true), 60000);
  });
})();
