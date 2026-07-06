document.addEventListener("DOMContentLoaded", () => {
    const projectsContainer = document.getElementById("projectsContainer");
    const searchInput = document.getElementById("projectSearch");
    const loader = document.getElementById("loader");
    const currentUrl = window.location.href;
    const urlObj = new URL(currentUrl);
    const queryParams = new URLSearchParams(urlObj.search);
    const projectId = queryParams.get('id');
    let currentPage = 1;
    let currentQuery = '';
    let totalPages = 1;
    let isLoading = false;
    async function fetchProjects(page = 1, query = '', append = false) {
        if (isLoading) return;
        if (page > totalPages) return;
        isLoading = true;
        loader.style.display = 'block';

        try {
            const response = await fetch(
                `${baseUrl}/api/projects/search?q=${encodeURIComponent(query)}&page=${page}&limit=10&projectId=${encodeURIComponent(projectId)}`,
                { credentials: 'include' }
            );

            const data = await response.json();

            if (data.success && data.count > 0) {
                totalPages = data.pagination.totalPages;
                renderProjects(data.data, append);
            } else if (!append) {
                projectsContainer.innerHTML = '<p>No projects found.</p>';
            }
        } catch (error) {
            if (!append) projectsContainer.innerHTML = '<p>Error loading projects.</p>';
        } finally {
            isLoading = false;
            loader.style.display = 'none';
        }
    }

    function renderProjects(projects, append = false) {
        if (!append) projectsContainer.innerHTML = '';

        projects.forEach(project => {

            // Manager display rule
            const managers = Array.isArray(project.projectManager)
                ? (project.projectManager.length <= 2
                    ? project.projectManager.map(m => m.name).join(', ')
                    : `${project.projectManager.length} Managers Assigned`)
                : project.projectManager?.name || 'Unassigned';

            const createdDate = formatDateTime(
                project.createdAt ?? project.projectStartDate
            );

            const card = document.createElement('div');
            card.className = 'col-sm-3 d-flex';

            card.innerHTML = `
            <div class="card projectcard position-relative w-100">
                <div class="card-body pjcrdbody">

                    <h5 class="fs-20 fw-normal mb-2">
                        ${project.projectName ?? 'Unnamed Project'}
                    </h5>

                    <a href="/projects/${project._id}/details" 
                       class="position-absolute top-0 end-0 mt-2 me-4 text-primary fs-12 fw-light text-decoration-none">
                       View
                    </a>

                    <small class="fs-12 text-black fw-light">
                        Created on: ${createdDate}
                    </small>

                    <h6 class="fs-16 fw-normal mt-2 text-neutral">
                        ${managers}
                    </h6>

                    <small class="fs-12 fw-light">
                        Status: ${project.projectStatus ?? 'Unknown'}
                    </small>

                    <div class="prjtxt mt-3">

    <div class="dflexbtwn fs-12 fw-light mb-2">
        <span>Total Files: ${project.totalFiles ?? ''}</span>
        <span>Storage Used: ${project.storageConsumed ?? '0 KB'}</span>
    </div>

    <div class="dflexbtwn">
        <a href="/documents/list?project=${project._id}" class="site-btnmd fw-light fs-12">Access Files</a>
        <span>${project.totalTags ?? 0} Tags</span>
    </div>

</div>

                </div>
            </div>
        `;

            projectsContainer.appendChild(card);
        });
    }

    // Infinite scroll
    window.addEventListener('scroll', () => {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 300) {
            if (!isLoading && currentPage < totalPages) {
                currentPage++;
                fetchProjects(currentPage, currentQuery, true);
            }
        }
    });

    // Debounce function
    function debounce(func, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
    const handleSearch = debounce(() => {
        currentQuery = searchInput.value.trim();

        // When input is empty → reload all projects
        if (currentQuery.length === 0) {
            projectsContainer.innerHTML = '';
            currentPage = 1;
            totalPages = 1;
            fetchProjects(currentPage, '', false);
            return;
        }

        //When input has 1 character → show "type at least 2 chars"
        if (currentQuery.length < 2) {
            projectsContainer.innerHTML = '<p>Type at least 2 characters to search.</p>';
            return;
        }

        //Normal search
        currentPage = 1;
        totalPages = 1;
        fetchProjects(currentPage, currentQuery, false);
    }, 400);


    searchInput.addEventListener("input", handleSearch);


    // Initial load
    fetchProjects();
});
