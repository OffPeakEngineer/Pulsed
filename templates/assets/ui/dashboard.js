// frontend/main.ts
function attachNodeLinks() {
  const base = document.getElementById("open-pages");
  document.querySelectorAll(".node-detail-link").forEach((link) => {
    const update = () => {
      const url = new URL(base.href, location.href);
      url.searchParams.set("focus", link.dataset.node);
      for (const key of ["theme", "palette"]) {
        const value = document.documentElement.dataset[key];
        if (value) url.searchParams.set(key, value);
      }
      url.hash = "node";
      link.href = url.href;
    };
    update();
    link.addEventListener("click", update);
    link.addEventListener("auxclick", update);
  });
}
attachNodeLinks();
document.addEventListener("pulsed:snapshot", attachNodeLinks);
document.documentElement.classList.add("versytl-ready");
