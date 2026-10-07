import { orderClusterCores } from "./core-order.js";
function orderOverviewCores() {
    const select = document.getElementById('core-order');
    const host = document.getElementById('cluster-cores');
    const cores = Array.from(host.querySelectorAll('.core-bar'), element => ({
        node: element.dataset.node, index: Number(element.dataset.core), percent: Number(element.dataset.percent), element,
    }));
    host.replaceChildren(...orderClusterCores(cores, select.value).map(core => core.element));
    document.getElementById('cluster-cores-empty').hidden = cores.length !== 0;
}
orderOverviewCores();
// The inline dashboard controller restores saved preferences at DOMContentLoaded.
document.addEventListener('DOMContentLoaded', orderOverviewCores);
document.addEventListener('change', event => {
    const select = event.target;
    if (select.id !== 'core-order')
        return;
    try {
        localStorage.setItem('pulsed-core-order', select.value);
    }
    catch { }
    orderOverviewCores();
});
document.addEventListener('pulsed:snapshot', orderOverviewCores);
// Node inspection lives in Stasis; the performance overview stays server rendered.
function attachNodeLinks() {
    const base = document.getElementById('open-pages');
    document.querySelectorAll('.node-detail-link').forEach(link => {
        const update = () => {
            const url = new URL(base.href, location.href);
            url.searchParams.set('focus', link.dataset.node);
            for (const key of ['theme', 'palette']) {
                const value = document.documentElement.dataset[key];
                if (value)
                    url.searchParams.set(key, value);
            }
            url.hash = 'node';
            link.href = url.href;
        };
        update();
        link.addEventListener('click', update);
        link.addEventListener('auxclick', update);
    });
}
attachNodeLinks();
document.addEventListener('pulsed:snapshot', attachNodeLinks);
document.documentElement.classList.add('versytl-ready');
