export function buildMenuTree(data) {
    const menus = data.filter(m => m.type === "Menu");
    const subMenus = data.filter(m => m.type === "SubMenu");

    function getChildren(parentId) {
        return subMenus
            .filter(s => s.master_id?.toString() === parentId.toString())
            .sort((a, b) => a.priority - b.priority);
    }

    return menus
        .filter(m => m.is_show)
        .sort((a, b) => a.priority - b.priority)
        .map(menu => ({
            ...menu,
            children: getChildren(menu._id)
        }));
}
