const truncateName = (name, maxLength = 20) => {
    if (!name) return '';
    return name.length > maxLength ? name.slice(0, maxLength - 3) + '...' : name;
};