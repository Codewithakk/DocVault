// projects.js
document.addEventListener("DOMContentLoaded", () => {
    const projectTableBody = document.querySelector(".datatable tbody");
    const paginationContainer = document.createElement("div");
    paginationContainer.classList.add("mt-3", "d-flex", "justify-content-center", "gap-2");
    document.querySelector(".datatable").after(paginationContainer);

    let currentPage = 1;
    let totalPages = 1;
    const urlParams = new URLSearchParams(window.location.search);
    const searchKeyword = urlParams.get("q") || "";

    // Fetch Projects
    async function fetchProjects(page = 1) {
        try {
            let url = `${baseUrl}/api/projects/search?page=${page}&limit=10`;
            if (searchKeyword) url += `&q=${encodeURIComponent(searchKeyword)}`;

            const res = await fetch(url, { credentials: "include" });
            const result = await res.json();

            totalPages = result.pagination?.totalPages || 1;
            projectTableBody.innerHTML = "";

            if (!result.data || result.data.length === 0) {
                projectTableBody.innerHTML = `<tr><td colspan="13" class="text-center">No projects found</td></tr>`;
                renderPagination();
                return;
            }

            result.data.forEach(project => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>
                        <div class="btn-group" role="group">
                            <button type="button" class="btn border-0" data-bs-toggle="dropdown" aria-expanded="false">
                                <i class="ti ti-settings"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#"><i class="ti ti-eye"></i> View</a></li>
                                <li><a class="dropdown-item" href="/documents/add"><i class="ti ti-pencil-minus"></i> Edit</a></li>
                            </ul>
                        </div>
                    </td>
                    <td>
                        <div class="flxtblleft">
                            <span class="avatar rounded bg-light mb-2">
                                <img src="/img/icons/fn1.png">
                            </span>
                            <div class="flxtbltxt">
                                <p class="fs-14 mb-1 fw-normal text-neutral">${project.projectName}</p>
                                <span class="fs-11 fw-light text-black">190KB</span>
                            </div>
                        </div>
                    </td>
                    <td><p class="tbl_date">${formatDateTime(project.projectEndDate)} &nbsp;&nbsp; ${formatDateTime(project.projectEndDate)}</p></td>
                    <td><p>${project.projectManager?.name || "—"}</p></td>
                    <td><p>${project.department?.name || "—"}</p></td>
                    <td><p>${project.projectName}</p></td>
                    <td><p>—</p></td>
                    <td><p>${(project.tags || []).join(", ")}</p></td>
                    <td><p>Document</p></td>
                    <td><p class="tbl_date">${formatDateTime(project.createdAt)} &nbsp;&nbsp; ${formatDateTime(project.createdAt)}</p></td>
                    <td><p>${project.projectDescription || ""}</p></td>
                    <td><p>—</p></td>
                    <td><span class="badge badge-md bg-soft-success">${project.projectStatus || "Unknown"}</span></td>
                `;
                projectTableBody.appendChild(tr);
            });

            renderPagination();
        } catch (error) {
            showToast("Error fetching projects:" + error, 'error');
        }
    }

    // Pagination
    function renderPagination() {
        paginationContainer.innerHTML = "";

        const prevBtn = document.createElement("button");
        prevBtn.classList.add("btn", "btn-outline-primary");
        prevBtn.textContent = "Previous";
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener("click", () => {
            if (currentPage > 1) {
                currentPage--;
                fetchProjects(currentPage);
            }
        });

        const nextBtn = document.createElement("button");
        nextBtn.classList.add("btn", "btn-outline-primary");
        nextBtn.textContent = "Next";
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener("click", () => {
            if (currentPage < totalPages) {
                currentPage++;
                fetchProjects(currentPage);
            }
        });

        const pageInfo = document.createElement("span");
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        pageInfo.classList.add("align-self-center");

        paginationContainer.appendChild(prevBtn);
        paginationContainer.appendChild(pageInfo);
        paginationContainer.appendChild(nextBtn);
    }

    // Init
    fetchProjects(currentPage);
});
