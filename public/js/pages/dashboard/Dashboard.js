$(document).ready(function () {
    const baseUrl = window.baseUrl || '';
    let currentProjectId = '';
    let currentPeriod = 'year';
    let typeUploadsperiod = 'year';
    let isInitialized = false;

    // File type icons
    const fileIcons = {
        ppt: "/img/icons/fn1.png",
        pptx: "/img/icons/fn1.png",
        doc: "/img/icons/fn2.png",
        docx: "/img/icons/fn2.png",
        xls: "/img/icons/fn3.png",
        xlsx: "/img/icons/fn3.png",
        pdf: "/img/icons/fn4.png",
        default: "/img/icons/fn1.png"
    };

    // Safe Select2 init (prevents double initialization)
    function safeSelect2Init(selector, initFn) {
        const $el = $(selector);
        if ($el.hasClass('select2-hidden-accessible')) {
            $el.select2('destroy');
        }
        initFn();
    }

    function initializeDonorSelect2() {
        $('#dashboardDonor').select2({
            placeholder: 'Donor Name ',
            allowClear: true,
            width: '180px',
            ajax: {
                url: '/api/user/search',
                dataType: 'json',
                delay: 250,
                data: function (params) {
                    return {
                        search: params.term || '',
                        page: params.page || 1,
                        limit: 10,
                        profile_type: 'donor'
                    };
                },
                processResults: function (data, params) {
                    params.page = params.page || 1;
                    if (data.users && Array.isArray(data.users)) {
                        const results = data.users.map(u => ({
                            id: u._id,
                            text: u.name || 'Unknown Donor'
                        }));
                        return {
                            results,
                            pagination: {
                                more: params.page * 10 < (data.pagination?.total || 0)
                            }
                        };
                    }
                    return { results: [] };
                },
                cache: true
            },
            minimumInputLength: 0
        }).on('change', function () {
            loadDonorVendorProjects();
        });
    }

    // Initialize Vendor Select2 with proper configuration
    function initializeVendorSelect2() {
        $('#dashboardVendor').select2({
            placeholder: 'Vendor Name ',
            allowClear: true,
            width: '180px',
            ajax: {
                url: '/api/user/search',
                dataType: 'json',
                delay: 250,
                data: function (params) {
                    return {
                        search: params.term || '',
                        page: params.page || 1,
                        limit: 10,
                        profile_type: 'vendor'
                    };
                },
                processResults: function (data, params) {
                    params.page = params.page || 1;
                    if (data.users && Array.isArray(data.users)) {
                        const results = data.users.map(u => ({
                            id: u._id,
                            text: u.name || 'Unknown Vendor'
                        }));
                        return {
                            results,
                            pagination: {
                                more: params.page * 10 < (data.pagination?.total || 0)
                            }
                        };
                    }
                    return { results: [] };
                },
                cache: true
            },
            minimumInputLength: 0
        }).on('change', function () {
            loadDonorVendorProjects();
        });
    }
    // Load storage data from API
    async function loadStorageData(projectId = '') {
        try {
            const url = `/api/myStorage`;
            
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.success && result.data) {
                const data = result.data;
                
                // Use the percentage directly from API
                const usedPercentage = data.usedPercentage || 0;
                const remainingPercentage = data.remainingPercentage || 100;
                
                // Update progress bar (show used percentage)
                const progressBar = document.querySelector('.progress-bar');
                if (progressBar) {
                    progressBar.style.width = `${usedPercentage}%`;
                    progressBar.setAttribute('aria-valuenow', usedPercentage);
                    
                    // Color coding based on usage
                    if (usedPercentage > 90) {
                        progressBar.className = 'progress-bar bg-danger rounded';
                    } else if (usedPercentage > 75) {
                        progressBar.className = 'progress-bar bg-warning rounded';
                    } else {
                        progressBar.className = 'progress-bar bg-info rounded';
                    }
                }
                
                // Update storage summary text
                const summaryText = document.querySelector('.d-flex.align-items-center.justify-content-between p:first-child');
                if (summaryText) {
                    const usedGB = data.usedStorage || 0;
                    const totalGB = data.totalStorage || 0;
                    summaryText.textContent = `${usedGB.toFixed(2)} GB used of ${totalGB.toFixed(2)} GB`;
                }
                
                // Update percentage text
                const percentageText = document.querySelector('.d-flex.align-items-center.justify-content-between p.text-title');
                if (percentageText) {
                    percentageText.textContent = `${Math.round(usedPercentage)}%`;
                }
                
                // Update storage distribution
                updateStorageDistribution(data);
            } else {
                console.error('Failed to load storage data:', result.message);
                showStorageError();
            }
        } catch (error) {
            console.error('Error loading storage data:', error);
            showStorageError();
        }
    }
    
    // Helper function to show error state
    function showStorageError() {
        const progressBar = document.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.setAttribute('aria-valuenow', 0);
        }
        const summaryText = document.querySelector('.d-flex.align-items-center.justify-content-between p:first-child');
        if (summaryText) {
            summaryText.textContent = 'Error loading storage data';
        }
        const percentageText = document.querySelector('.d-flex.align-items-center.justify-content-between p.text-title');
        if (percentageText) {
            percentageText.textContent = '0%';
        }
    }
    // Update storage distribution items
    function updateStorageDistribution(data) {
        const folderWraps = document.querySelectorAll('.folder-wrap');
        
        if (folderWraps.length >= 3) {
            // Get storage values in GB - use the exact values from API
            const docSize = data.documents || 0;
            const mediaSize = data.media || 0;
            const othersSize = data.others || 0;
            
            // Get the percentage values from API (optional - if you want to show percentages)
            const docPercentage = data.documentsPercentage || 0;
            const mediaPercentage = data.mediaPercentage || 0;
            const othersPercentage = data.othersPercentage || 0;
            
            // Get counts
            const docCount = data.documentsCount || 0;
            const mediaCount = data.mediaCount || 0;
            const othersCount = data.othersCount || 0;
            
            // Update the h6 elements with GB values
            // For very small values, show in MB instead of GB
            const docDisplay = docSize < 0.001 ? `${(docSize * 1024).toFixed(2)} MB` : `${docSize.toFixed(2)} GB`;
            const mediaDisplay = mediaSize < 0.001 ? `${(mediaSize * 1024).toFixed(2)} MB` : `${mediaSize.toFixed(2)} GB`;
            const othersDisplay = othersSize < 0.001 ? `${(othersSize * 1024).toFixed(2)} MB` : `${othersSize.toFixed(2)} GB`;
            
            folderWraps[0].querySelector('h6').textContent = docDisplay;
            folderWraps[1].querySelector('h6').textContent = mediaDisplay;
            folderWraps[2].querySelector('h6').textContent = othersDisplay;
            
            // Update the labels with file counts (showing the count from API)
            const labels = document.querySelectorAll('.folder-wrap .fs-12');
            if (labels.length >= 3) {
                // Update the labels to show counts (if you want)
                // labels[0].textContent = `Files (${docCount} files)`;
                // labels[1].textContent = `Media (${mediaCount} files)`;
                // labels[2].textContent = `Others (${othersCount} files)`;
                
                // OR update to show percentages
                // labels[0].textContent = `Files (${docPercentage.toFixed(1)}%)`;
                // labels[1].textContent = `Media (${mediaPercentage.toFixed(1)}%)`;
                // labels[2].textContent = `Others (${othersPercentage.toFixed(1)}%)`;
                
                // Keep original labels but maybe add count as tooltip or secondary text
                // Currently keeping the labels as "Files", "Media", "Others"
            }
        }
    }
    // Load current project from session
    async function loadCurrentProject() {
        try {
            const response = await fetch(`${baseUrl}/api/session/project`, {
                credentials: 'include'
            });
            const data = await response.json();

            if (data.selectedProject) {
                currentProjectId = data.selectedProject;
                $('#currentProjectName').text(data.selectedProjectName || 'No project selected');

                if ($('#uploadDepartment').length && currentProjectId) {
                    $('#uploadDepartment').val(currentProjectId).trigger('change');
                }
            }
        } catch (error) {
            console.error('Error loading current project:', error);
        }
    }

    // Initialize Header Project Select
    function initializeHeaderProjectSelect() {
        const $headerProjectSelect = $('#selectHeaderProject');
        if (!$headerProjectSelect.length) return;

        $headerProjectSelect.select2({
            placeholder: 'Select project',
            allowClear: true,
            width: '200px',
            ajax: {
                url: `${baseUrl}/api/projects`,
                dataType: 'json',
                delay: 250,
                data: function (params) {
                    return {
                        search: params.term || '',
                        page: params.page || 1,
                        limit: 10
                    };
                },
                processResults: function (data) {
                    return {
                        results: (data.data || []).map(p => ({
                            id: p._id,
                            text: p.projectName || p.name
                        }))
                    };
                },
                cache: true
            }
        });

        $headerProjectSelect.on('select2:select select2:unselect', async function () {
            const projectId = $(this).val();
            const projectName = $(this).find('option:selected').text() || '';

            try {
                const res = await fetch(`${baseUrl}/api/session/project`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        projectId: projectId || null,
                        projectName: projectName
                    })
                });

                if (!res.ok) throw new Error('Failed to save project selection');
                await res.json();

                currentProjectId = projectId || '';

                if (projectId) {
                    $('#currentProjectName').text(projectName);
                    loadDepartmentUploads(projectId, currentPeriod);
                    loadDocumentTypeUploads(projectId, typeUploadsperiod);
                    loadDashboardStats(projectId);
                } else {
                    $('#currentProjectName').text('No project selected');
                    loadDepartmentUploads('', currentPeriod);
                    loadDocumentTypeUploads('', typeUploadsperiod);
                    loadDashboardStats('');
                }

                // Reload recent docs table
                loadDocumentsFiltered(currentProjectId);

            } catch (err) {
                console.error('Error saving project selection:', err);
            }
        });
    }

    // Initialize Recent Activity Department
    function initializeRecentActivityDepartment() {
        $("#recentActivityDepartment").select2({
            placeholder: "Select Department",
            allowClear: true,
            // width: '200px',
            ajax: {
                url: '/api/departments/search',
                dataType: 'json',
                delay: 250,
                data: function (params) {
                    return {
                        search: params.term || '',
                        page: params.page || 1,
                        limit: 50
                    };
                },
                processResults: function (data) {
                    let results = data.data.map(dep => ({ id: dep._id, text: dep.name }));
                    results.unshift({ id: '', text: '-- All Departments --' });
                    return { results };
                },
                cache: true
            }
        });
    }

    // Recent Activity Filter Change
    $('#recentActivityDepartment, #recentActivitySort').on('change', function () {
        const departmentId = $('#recentActivityDepartment').val() || '';
        const sortBy = $('#recentActivitySort').val() || 'updatedAt';
        loadDocumentsFiltered(currentProjectId, departmentId, sortBy);
    });

    // File Status
    async function loadFileStatus(projectId = '') {
        try {
            const url = projectId
                ? `/api/dashboard/file-status?projectId=${projectId}`
                : '/api/dashboard/file-status';

            const response = await fetch(url);
            const data = await response.json();

            if (!data.success || !data.files) {
                $('#fileList').html('<div class="text-center text-muted py-3">No files found</div>');
                return;
            }

            const fileList = document.getElementById('fileList');
            fileList.innerHTML = '';

            data.files.forEach(file => {
                const formattedDate = formatDateTime(file.lastActionTime);
                const fileItem = document.createElement('div');
                fileItem.className = 'dflexbtwn flxtblrow align-items-center py-2';

                fileItem.innerHTML = `
                    <div class="tbl-col file-name">
                        <span class="avatar rounded bg-light me-2">
                            <img src="${file.icon}" alt="icon" data-id="${file._id}" class="file-icon" style="width:24px;height:24px;">
                        </span>
                        <div class="flxtbltxt">
                            <p class="fs-14 mb-1 fw-normal filestatusName">${file.name}</p>
                            <span class="fs-11 fw-light text-black">${file.fileSize}</span>
                        </div>
                    </div>
                    <div class="tbl-col user-name fs-14 fw-light text-black">${file.performedBy?.name || 'Unknown'}</div>
                    <div class="tbl-col time fs-14 fw-light text-black">${formattedDate}</div>
                    <div class="tbl-col file-status fs-14 fw-light text-black">${file.status}</div>
                `;

                fileList.appendChild(fileItem);
            });

            // Double-click to open
            $('.file-icon').off('dblclick').on('dblclick', function () {
                const fileId = $(this).data('id');
                if (fileId) window.open(`/folders/view/${fileId}`, '_blank');
            });

        } catch (error) {
            console.error('Error fetching file status:', error);
        }
    }

    // Recent Activities
    async function loadRecentActivities(projectId = '') {
        try {
            const url = projectId
                ? `${baseUrl}/api/dashboard/recent-activity?projectId=${projectId}`
                : `${baseUrl}/api/dashboard/recent-activity`;

            const response = await fetch(url);
            const result = await response.json();

            const container = $('#recentActivityContainer');
            container.empty();

            if (!result.recentActivities || result.recentActivities.length === 0) {
                container.append('<div class="text-center text-muted mt-3"><p>No recent activity found</p></div>');
                return;
            }

            result.recentActivities.forEach(activity => {
                const details = activity.details || 'Activity performed';
                const formattedDateTime = formatDateTime(activity.timestamp);

                const cardItem = `
                    <div class="d-flex flex-column flex-md-row justify-content-between mb-3">
                        
                        <div class="d-flex align-items-center">
                            <span class="avatar rounded-3 bg-light me-2">
                                <img src="/img/icons/user-activity.svg" alt="activity" class="icon-20">
                            </span>

                            <div> 
                                <p class="fs-16 fw-normal">
                                    ${details}
                                </p>
                            </div>
                        </div>

                        <div class="text-md-end text-muted fs-13 mt-2 mt-md-0">
                            ${formattedDateTime}
                        </div>

                    </div>
                `;

                container.append(cardItem);
            });

        } catch (err) {
            console.error('Error loading recent activities:', err);
            $('#recentActivityContainer').html('<div class="text-center text-danger mt-3"><p>Failed to load</p></div>');
        }
    }


    // Upload Department Select
    function initializeUploadDepartment() {
        $("#uploadDepartment").select2({
            placeholder: "Select Departments",
            allowClear: true,
            width: '200px',
            ajax: {
                url: '/api/departments/search',
                dataType: 'json',
                delay: 250,
                data: function (params) {
                    return {
                        search: params.term || '',
                        page: params.page || 1,
                        limit: 50
                    };
                },
                processResults: function (data) {
                    let results = data.data.map(dep => ({ id: dep._id, text: dep.name }));
                    results.unshift({ id: '', text: '-- All Departments --' });
                    return { results };
                },
                cache: true
            }
        });

        $("#uploadDepartment").on('change', function () {
            const departmentId = $(this).val() || '';
            loadDepartmentDocumentUploads(currentProjectId, currentPeriod, $('#uploadDepartment').val() || '');
        });
    }

    // Department Document Uploads Chart
    function loadDepartmentDocumentUploads(projectId = '', period = 'year', departmentId = '') {
        if (!$('#sales-income').length) return;

        const params = new URLSearchParams();
        if (projectId) params.append('projectId', projectId);
        if (period) params.append('period', period);
        if (departmentId) params.append('departmentId', departmentId);

        const url = `${baseUrl}/api/dashboard/documentUploads?${params.toString()}`;

        $.ajax({
            url: url,
            method: 'GET',
            dataType: 'json',
            success: function (result) {
                if (!result.success || !result.monthlyStatusCounts) {
                    console.warn('No monthlyStatusCounts in response');
                    createEmptySalesChart();
                    return;
                }

                // Ensure 12 months in order
                const monthlyData = Array(12).fill().map((_, i) => {
                    const monthData = result.monthlyStatusCounts.find(m => m.month === i + 1);
                    return monthData || { Pending: 0, Approved: 0, Rejected: 0 };
                });

                const pendingData = monthlyData.map(m => m.Pending || 0);
                const approvedData = monthlyData.map(m => m.Approved || 0);
                const rejectedData = monthlyData.map(m => m.Rejected || 0);

                const maxValue = Math.max(...[...pendingData, ...approvedData, ...rejectedData]) + 1;

                const options = {
                    chart: {
                        height: 290,
                        type: 'bar',
                        stacked: true,
                        toolbar: { show: false }
                    },
                    colors: ['#197BF7', '#2BB68D', '#F15C44'], // Pending, Approved, Rejected
                    plotOptions: {
                        bar: {
                            borderRadius: 5,
                            borderRadiusWhenStacked: 'all',
                            horizontal: false,
                            endingShape: 'rounded',
                            columnWidth: '45%',
                        }
                    },
                    series: [
                        { name: 'Pending', data: pendingData },
                        { name: 'Approved', data: approvedData },
                        { name: 'Rejected', data: rejectedData }
                    ],
                    xaxis: {
                        categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                        labels: { style: { colors: '#6B7280', fontSize: '13px' } }
                    },
                    yaxis: {
                        title: { text: 'Number of Documents', style: { color: '#6B7280', fontSize: '13px' } },
                        labels: { style: { colors: '#6B7280', fontSize: '13px' } },
                        min: 0,
                        max: maxValue,
                        tickAmount: maxValue > 5 ? 5 : maxValue
                    },
                    grid: { borderColor: '#E5E7EB', strokeDashArray: 5, padding: { left: -8 } },
                    legend: { show: false },
                    dataLabels: { enabled: false },
                    fill: { opacity: 1 },
                    tooltip: {
                        y: {
                            formatter: function (val) {
                                return val + " doc" + (val !== 1 ? "s" : "");
                            }
                        }
                    }
                };

                // Destroy old chart if exists
                if (window.salesChart) {
                    window.salesChart.destroy();
                }

                // Render new chart
                window.salesChart = new ApexCharts(document.querySelector("#sales-income"), options);
                window.salesChart.render();
            },
            error: function (err) {
                console.error('Error loading department document uploads:', err);
                createEmptySalesChart();
            }
        });
    }

    function createEmptySalesChart() {
        if (window.salesChart) {
            window.salesChart.destroy();
        }

        const options = {
            chart: {
                height: 290,
                type: 'bar',
                stacked: true,
                toolbar: { show: false }
            },
            series: [
                { name: 'Pending', data: [] },
                { name: 'Approved', data: [] },
                { name: 'Rejected', data: [] }
            ],
            xaxis: { categories: [] },
            noData: { text: 'No data available' }
        };

        window.salesChart = new ApexCharts(document.querySelector("#sales-income"), options);
        window.salesChart.render();
    }

    // Dashboard Stats
    function loadDashboardStats(projectId = '') {
        const url = projectId
            ? `${baseUrl}/api/dashboard/stats?projectId=${projectId}`
            : `${baseUrl}/api/dashboard/stats`;

        $.ajax({
            url: url,
            type: "GET",
            dataType: "json",
            success: function (response) {
                if (response.success && response.data) {
                    const d = response.data;

                    // Top stats
                    $('#totalDocs').text(d.total || 0);
                    $('#approvedDocs').text(d.approved || 0);
                    $('#pendingDocs').text(d.pending || 0);
                    $('#rejectedDocs').text(d.rejected || 0);
                    $('#pendingCount').text(d.pending || 0);

                    updateGrowthBadge('#totalDocs', d.totalGrowth);
                    updateGrowthBadge('#approvedDocs', d.approvedGrowth);
                    updateGrowthBadge('#pendingDocs', d.pendingGrowth);
                    updateGrowthBadge('#rejectedDocs', d.rejectedGrowth);

                    // Department cards
                    renderDepartmentCards(d.departmentDocumentCounts || []);
                }
            },
            error: function (xhr, status, err) {
                console.error("Failed to fetch dashboard stats:", err);
            }
        });
    }


    function updateGrowthBadge(cardSelector, growthPercent) {
        const $card = $(cardSelector).closest('.card');
        const $badge = $card.find('.text-success, .text-danger').first();

        if (growthPercent === undefined || growthPercent === null) {
            $badge.html('<span class="sm-avatar avatar rounded bg-soft-secondary"><i class="ti ti-minus"></i></span> 0%');
            return;
        }

        const isPositive = growthPercent >= 0;
        const icon = isPositive ? 'ti ti-trending-up' : 'ti ti-trending-down';
        const colorClass = isPositive ? 'bg-soft-success text-success' : 'bg-soft-danger text-danger';

        $badge.html(`
            <i class="${icon}"></i>
        ${isPositive ? '+' : ''}${growthPercent}%
    `);
    }

    // Load Donor/Vendor Projects with proper period handling
    async function loadDonorVendorProjects() {
        const donorId = $('#dashboardDonor').val() || '';
        const vendorId = $('#dashboardVendor').val() || '';
        const period = $('#currentDonorVendorPeriodLabel').data('period') || 'year';

        try {
            const params = new URLSearchParams();
            if (donorId) params.append('donorId', donorId);
            if (vendorId) params.append('vendorId', vendorId);
            if (period) params.append('period', period);

            const response = await fetch(`/api/dashboard/donorVendorProjects?${params.toString()}`);
            const result = await response.json();

            if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
                createEmptyDonorVendorChart();
                return;
            }

            const data = result.data;

            const categories = data.map(item => item.projectType || 'Unknown Type');

            // If both donorCount and vendorCount are 0, set to null (no bar)
            const donorSeries = data.map(item => {
                return (item.donorCount || item.vendorCount) === 0 ? null : (item.donorCount ?? 0);
            });

            const vendorSeries = data.map(item => {
                return (item.donorCount || item.vendorCount) === 0 ? null : (item.vendorCount ?? 0);
            });

            if (window.donorVendorChart) {
                window.donorVendorChart.destroy();
            }

            const options = {
                series: [
                    { name: "Donor", data: donorSeries, color: '#008FFB' },
                    { name: "Vendor", data: vendorSeries, color: '#FF4560' }
                ],
                chart: { type: 'bar', height: 400, toolbar: { show: false } },
                plotOptions: {
                    bar: { horizontal: false, columnWidth: '55%', borderRadius: 5, borderRadiusApplication: 'end' },
                },
                dataLabels: { enabled: false },
                stroke: { show: true, width: 2, colors: ['transparent'] },
                xaxis: { categories, labels: { style: { colors: '#6B7280', fontSize: '12px' } } },
                yaxis: {
                    title: { text: "Number of Projects", style: { color: '#6B7280', fontSize: '12px' } },
                    labels: { style: { colors: '#6B7280', fontSize: '11px' } }
                },
                fill: { opacity: 1 },
                // tooltip: { y: { formatter: val => val !== null ? `${val} project${val !== 1 ? 's' : ''}` : '0 projects' } },
                legend: {
                    position: 'top',
                    horizontalAlign: 'right',
                    fontSize: '12px',
                    markers: { width: 12, height: 12, radius: 6 }
                },
                grid: { borderColor: '#E5E7EB', strokeDashArray: 4, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
                noData: {
                    text: 'No data available',
                    align: 'center',
                    verticalAlign: 'middle',
                    style: { color: '#6B7280', fontSize: '14px' }
                }
            };

            const chartEl = document.querySelector("#donorvendorprojects");
            chartEl.innerHTML = '';

            window.donorVendorChart = new ApexCharts(chartEl, options);
            window.donorVendorChart.render();

        } catch (error) {
            console.error('Error loading donor/vendor projects:', error);
            createEmptyDonorVendorChart();
        }
    }


    // Create empty state for chart
    function createEmptyDonorVendorChart() {
        const chartEl = document.querySelector("#donorvendorprojects");

        // Destroy existing chart if it exists
        if (window.donorVendorChart) {
            window.donorVendorChart.destroy();
        }

        // Create empty chart with message
        const options = {
            series: [{
                name: "No Data",
                data: []
            }],
            chart: {
                type: 'bar',
                height: 400,
                toolbar: { show: false }
            },
            xaxis: {
                categories: []
            },
            noData: {
                text: 'No data available',
                align: 'center',
                verticalAlign: 'middle',
                style: {
                    color: '#6B7280',
                    fontSize: '14px'
                }
            }
        };

        window.donorVendorChart = new ApexCharts(chartEl, options);
        window.donorVendorChart.render();
    }

    // Pre-populate Donor and Vendor dropdowns on page load
    async function preloadDonorVendorOptions() {
        try {
            // Preload donors
            const donorResponse = await fetch('/api/user/search?profile_type=donor');
            const donorData = await donorResponse.json();

            if (donorData.users && donorData.users.length > 0) {
                $('#dashboardDonor').empty().append('<option value=""> Select Donor Name </option>');
                donorData.users.forEach(donor => {
                    $('#dashboardDonor').append(new Option(donor.name, donor._id));
                });
            }

            // Preload vendors
            const vendorResponse = await fetch('/api/user/search?profile_type=vendor');
            const vendorData = await vendorResponse.json();

            if (vendorData.users && vendorData.users.length > 0) {
                $('#dashboardVendor').empty().append('<option value=""> Select Vendor Name </option>');
                vendorData.users.forEach(vendor => {
                    $('#dashboardVendor').append(new Option(vendor.name, vendor._id));
                });
            }
        } catch (error) {
            console.error('Error preloading donor/vendor options:', error);
        }
    }
    // Recent Documents Table
    async function loadDocumentsFiltered(projectId = '', departmentId = '', sortBy = 'updatedAt') {
        try {
            const url = `${baseUrl}/api/documents${projectId ? `?projectId=${projectId}` : ''}`;
            const response = await fetch(url);
            const result = await response.json();

            if (!result.success || !Array.isArray(result.data?.documents)) {
                $('table tbody').html('<tr><td colspan="13" class="text-center text-muted">No documents found</td></tr>');
                return;
            }

            let documents = result.data.documents;

            if (departmentId) {
                documents = documents.filter(doc => doc.department?._id === departmentId);
            }

            documents.sort((a, b) => {
                switch (sortBy) {
                    case 'createdAt': return new Date(b.createdAt) - new Date(a.createdAt);
                    case 'updatedAt': return new Date(b.updatedAt) - new Date(a.updatedAt);
                    case 'metadata.fileName': return (a.metadata?.fileName || '').localeCompare(b.metadata?.fileName || '');
                    case 'status': return (a.status || '').localeCompare(b.status || '');
                    default: return 0;
                }
            });

            documents = documents.slice(0, 10);
            const tableBody = $('table tbody');
            tableBody.empty();

            if (documents.length === 0) {
                tableBody.append('<tr><td colspan="13" class="text-center text-muted">No Documents Found</td></tr>');
                return;
            }

            // Define the image detection logic outside the loop or inside
            documents.forEach(doc => {
                const fileSizeKB = doc.files.fileSize || 'N/A';
                const createdDate = formatDateTime(doc.createdAt);
                const updatedDate = formatDateTime(doc.updatedAt);
                const tags = doc.tags?.join(', ') || '-';
                const sharedWith = doc.sharedWithUsers?.length ? (() => {
                    const users = doc.sharedWithUsers.slice(0, 3);
                    const remaining = doc.sharedWithUsers.length - users.length;
                    const avatars = users.map(u => `<img src="${u.profile_image || '/img/users/user-01.jpg'}" class="avatar" title="${u.name}">`).join('');
                    const more = remaining > 0 ? `<div class="avatar avatar-more">+${remaining}</div>` : '';
                    return `<div class="avatar-group">${avatars}${more}</div>`;
                })() : '-';
            
                const statusKey = (doc.status || 'draft').toLowerCase();
                const statusClassName = statusClass[statusKey] || 'bg-soft-secondary';
            
                const description = doc.description
                    ? doc.description.replace(/<\/?[^>]+(>|$)/g, '').substring(0, 30) + (doc.description.length > 30 ? '...' : '')
                    : '-';
            
                const firstFile = doc.files;
                
                // --- USE THE IMAGE THUMBNAIL LOGIC HERE ---
                const ext = firstFile?.originalName?.split('.').pop()?.toLowerCase() || '';
                const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'];
                const isImage = imageExtensions.includes(ext);
                
                // Get the correct file URL/path
                const imagePath = firstFile?.fileUrl || firstFile?.url || '';
                
                // For images, use the actual image URL; for other files, use icon
                let fileIcon;
                if (isImage && imagePath) {
                    fileIcon = imagePath; // Use actual image URL
                } else {
                    fileIcon = fileIcons[ext] || fileIcons.default; // Use icon
                }
                
                const displayFileName = firstFile?.originalName || 'Untitled Document';
                const fileInfoHtml = `
                <div class="flxtblleft d-flex align-items-center" onclick="window.open('/folders/view/${firstFile?._id}', '_blank')" style="cursor: pointer;">
                    <span class="avatar rounded bg-light me-2 mb-2">
                        <img src="${fileIcon}" style="height:30px;" alt="icon">
                    </span>
                    <div class="flxtbltxt">
                        <p class="fs-14 mb-1 fw-normal">
                            ${displayFileName}
                            ${doc.files?.length > 1 ? ` +${doc.files.length - 1}` : ''}
                        </p>
                        <span class="fs-11 fw-light text-black">${fileSizeKB}</span>
                    </div>
                </div>
            `;
            
                const row = `
                    <tr>
                        <td>
                            <div class="btn-group" role="group">
                                <button type="button" class="btn border-0" data-bs-toggle="dropdown">
                                    <i class="ti ti-settings"></i>
                                </button>
                                <ul class="dropdown-menu">
                                    <li><a class="dropdown-item" href="/documents/${doc._id}/versions/view?version=""><i class="ti ti-eye"></i> View</a></li>
                                    <li><a class="dropdown-item" href="/documents/edit/${doc._id}"><i class="ti ti-pencil-minus"></i> Edit</a></li>
                                    <li><a class="dropdown-item share-btn" href="#" data-doc-id="${doc._id}" data-file-id="${firstFile?._id || ''}" data-bs-toggle="modal" data-bs-target="#sharedoc-modal"><i class="ti ti-share"></i> Share</a></li>
                                    <li><a class="dropdown-item" href="#" data-bs-toggle="modal" data-id="${doc._id}" data-bs-target="#versionhistory-modal"><i class="ti ti-history"></i> Version History</a></li>
                                    <li><a class="dropdown-item" href="#" data-bs-toggle="modal" data-file-id="${doc._id || ''}" data-bs-target="#downloaddoc-modal"><i class="ti ti-download"></i> Download</a></li>
                                    <li><a class="dropdown-item btn-delete" href="#" data-id="${doc._id}" data-bs-toggle="modal" data-bs-target="#trashdoc-modal"><i class="ti ti-trash"></i> Move to Trash</a></li>
                                    <li><a class="dropdown-item archive-document" href="#" data-id="${doc._id}" data-bs-toggle="modal" data-bs-target="#archivedoc-modal"><i class="ti ti-archive"></i> Move to Archive</a></li>
                                </ul>
                            </div>
                        </td>
                        <td>${fileInfoHtml}</td>
                        <td><p class="tbl_date">${updatedDate}</p></td>
                        <td><p>${doc.owner?.name || '-'}</p></td>
                        <td><p>${doc.department?.name || '-'}</p></td>
                        <td><p>${doc.project?.projectName || '-'}</p></td>
                        <td><p>${sharedWith}</p></td>
                        <td><p>${tags}</p></td>
                        <td><p>${doc.metadata?.mainHeading || '-'}</p></td>
                        <td><p class="tbl_date">${createdDate}</p></td>
                        <td><p>${description}</p></td>
                        <td><p>${doc.comment || '-'}</p></td>
                        <td><span class="badge badge-md ${statusClassName}">${doc.status || '-'}</span></td>
                    </tr>
                `;
            
                tableBody.append(row);
            });
        } catch (err) {
            console.error('Error loading documents:', err);
            $('table tbody').html('<tr><td colspan="13" class="text-center text-danger">Error loading documents</td></tr>');
        }
    }

    // Department Uploads
    function loadDepartmentUploads(projectId = '', period = 'year', departmentId = '') {
        if (!$('#departmentChartContainer').length) return;

        const params = new URLSearchParams();
        if (projectId) params.append('projectId', projectId);
        if (period) params.append('period', period);
        if (departmentId) params.append('departmentId', departmentId);

        const url = `${baseUrl}/api/dashboard/uploads?${params.toString()}`;

        $.ajax({
            url: url,
            method: "GET",
            dataType: "json",
            success: function (result) {
                const container = document.getElementById('departmentChartContainer');
                const hasData = result.success && result.data?.departmentUploads?.length > 0;
                const departments = hasData ? result.data.departmentUploads : [];

                // Sort and prepare data
                const sortedDepartments = [...departments].sort((a, b) => b.percentage - a.percentage);
                const chartData = sortedDepartments.map(d => ({
                    name: d.departmentName || 'Unknown',
                    y: d.percentage,
                    documentCount: d.documentCount
                }));

                // Always clear container first to prevent Highcharts ghosting
                container.innerHTML = '';

                // Destroy old chart instance if exists
                if (window.departmentChart) {
                    window.departmentChart.destroy();
                    window.departmentChart = null;
                }

                const chartOptions = {
                    chart: {
                        type: 'pie',
                        height: 400,
                        backgroundColor: 'transparent',
                        spacingTop: 10,
                        spacingBottom: 10,
                        spacingLeft: 10,
                        spacingRight: 10
                    },
                    title: { text: '' },
                    tooltip: {
                        pointFormat: '<b>{point.y:.1f}%</b> ({point.documentCount} docs)'
                    },
                    plotOptions: {
                        pie: {
                            innerSize: '70%',
                            allowPointSelect: true,
                            cursor: 'pointer',
                            borderRadius: 9,
                            dataLabels: {
                                enabled: true,
                                distance: 30,
                                format: '{point.percentage:.0f}%<br>{point.name}',
                                style: { fontSize: '11px', fontWeight: '600', textOutline: 'none' },
                                overflow: 'allow',
                                crop: false,
                                connectorWidth: 1,
                                connectorColor: '#cccccc',
                                softConnector: true,
                                connectorPadding: 5
                            },
                            size: '65%'
                        }
                    },
                    series: [{
                        name: 'Upload Share',
                        colorByPoint: true,
                        data: hasData ? chartData : [{
                            name: 'No Data',
                            y: 100,
                            color: '#e9ecef',
                            dataLabels: { enabled: false }
                        }]
                    }],
                    credits: { enabled: false },
                    exporting: { enabled: false }
                };

                // Create new chart
                window.departmentChart = Highcharts.chart(container, chartOptions);
                updateDepartmentCenterText(sortedDepartments);
            },
            error: function () {
                const container = document.getElementById('departmentChartContainer');
                container.innerHTML = '';
                if (window.departmentChart) {
                    window.departmentChart.destroy();
                }
                window.departmentChart = Highcharts.chart(container, {
                    chart: { type: 'pie', height: 400 },
                    title: { text: '' },
                    series: [{ data: [{ name: 'Error', y: 100, color: '#f8d7da' }], innerSize: '70%', dataLabels: { enabled: false } }],
                    credits: { enabled: false }
                });
                updateDepartmentCenterText([]);
            }
        });
    }
    function updateDepartmentCenterText(departments) {
        const $center = $('#departmentChartCenterText .center-text-content');
        if (departments.length > 0) {
            const top = departments[0];
            $center.html(`
            <p class="fs-13 mb-1 text-muted">${top.departmentName || 'N/A'}</p>
            <h4 class="mb-0 fw-bold">${top.percentage}%</h4>
        `);
        } else {
            $center.html(`
            <p class="fs-13 mb-1 text-muted">No Data</p>
            <h4 class="mb-0 fw-bold">0%</h4>
        `);
        }
    }

    function loadDocumentTypeUploads(projectId = '', period = 'year', departmentId = '') {
        if (!$('#documentTypeChartContainer').length) return;

        const params = new URLSearchParams();
        if (projectId) params.append('projectId', projectId);
        if (period) params.append('period', period);
        if (departmentId) params.append('departmentId', departmentId);

        const url = `${baseUrl}/api/dashboard/documentsTypeUploads?${params.toString()}`;

        $.ajax({
            url: url,
            method: "GET",
            dataType: "json",
            success: function (result) {
                const container = document.getElementById('documentTypeChartContainer');
                const hasData = result.success && result.data?.fileTypeBreakdown?.length > 0;
                const fileTypes = hasData ? result.data.fileTypeBreakdown : [];

                const sortedFileTypes = [...fileTypes].sort((a, b) => b.percentage - a.percentage);
                const chartData = sortedFileTypes.map(ft => ({
                    name: ft.type,
                    y: ft.percentage,
                    count: ft.count
                }));

                // Critical: Clear container + destroy old chart
                container.innerHTML = '';
                if (window.documentTypeChart) {
                    window.documentTypeChart.destroy();
                    window.documentTypeChart = null;
                }

                window.documentTypeChart = Highcharts.chart(container, {
                    chart: { type: 'pie', height: 400, backgroundColor: 'transparent' },
                    title: { text: '' },
                    tooltip: { pointFormat: '<b>{point.y:.1f}%</b> ({point.count} files)' },
                    plotOptions: {
                        pie: {
                            innerSize: '70%',
                            allowPointSelect: true,
                            cursor: 'pointer',
                            borderRadius: 9,
                            dataLabels: {
                                enabled: hasData,
                                distance: 20,
                                format: '{point.percentage:.0f}%<br>{point.name}',
                                style: { fontSize: '12px', textOutline: 'none' }
                            }
                        }
                    },
                    series: [{
                        name: 'File Type',
                        colorByPoint: true,
                        data: hasData ? chartData : [{
                            name: 'No Data',
                            y: 100,
                            color: '#e9ecef',
                            dataLabels: { enabled: false }
                        }]
                    }],
                    credits: { enabled: false },
                    exporting: { enabled: false }
                });

                updateDocumentTypeCenterText(sortedFileTypes);
            },
            error: function () {
                const container = document.getElementById('documentTypeChartContainer');
                container.innerHTML = '';
                if (window.documentTypeChart) window.documentTypeChart.destroy();
                Highcharts.chart(container, {
                    chart: { type: 'pie', height: 400 },
                    series: [{ data: [{ name: 'Error', y: 100, color: '#f8d7da' }], innerSize: '70%', dataLabels: { enabled: false } }],
                    credits: { enabled: false }
                });
                updateDocumentTypeCenterText([]);
            }
        });
    }
    // Update document type chart center text
    function updateDocumentTypeCenterText(fileTypes) {
        const $center = $('#documentTypeChartCenterText .center-text-content');
        if (fileTypes.length > 0) {
            const top = fileTypes[0];
            $center.html(`
            <p class="fs-13 mb-1 text-muted text-capitalize">${top.type || 'Unknown'}</p>
            <h3 class="mb-0 fw-bold">${top.percentage}%</h3>
        `);
        } else {
            $center.html(`
            <p class="fs-13 mb-1 text-muted">No Data</p>
            <h3 class="mb-0 fw-bold">0%</h3>
        `);
        }
    }

    // Helper function to create empty Highcharts chart
    function createEmptyHighchart(containerId, message) {
        const chartName = containerId.replace('ChartContainer', 'Chart');
        if (window[chartName]) {
            window[chartName].destroy();
        }

        Highcharts.chart(containerId, {
            chart: {
                type: 'pie',
                height: 400,
                margin: [0, 0, 0, 0],
                spacing: [0, 0, 0, 0]
            },
            title: {
                text: ''
            },
            series: [{
                name: 'No Data',
                data: [{
                    name: 'No Data',
                    y: 100,
                    color: '#e9ecef'
                }],
                innerSize: '70%',
                dataLabels: {
                    enabled: false
                }
            }],
            plotOptions: {
                pie: {
                    innerSize: '70%',
                    dataLabels: {
                        enabled: false
                    },
                    borderWidth: 3,
                    borderColor: '#fff'
                }
            },
            credits: {
                enabled: false
            },
            exporting: {
                enabled: false
            }
        });
    }

    $(document).on('click', '.donor-vendor-period-option', function () {
        const period = $(this).data('period');
        const label = $(this).text();

        $('#currentDonorVendorPeriodLabel')
            .text(label)
            .data('period', period);

        loadDonorVendorProjects();
    });

    function initializeDonorVendorSection() {

        initializeDonorSelect2();
        initializeVendorSelect2();

        preloadDonorVendorOptions();

        $('#currentDonorVendorPeriodLabel').data('period', 'year');

        loadDonorVendorProjects();
    }
    $(document).on('click', '.dept-upload-period-option', function () {
        const period = $(this).data('period');
        const label = $(this).text();
        $('#currentDeptUploadPeriodLabel').text(label);
        loadDepartmentUploads(currentProjectId, period, $('#uploadDepartment').val() || '');
    });

    $(document).on('click', '.doc-type-period-option', function () {
        const period = $(this).data('period');
        const label = $(this).text();
        currentPeriod = period;
        $('#currentDocTypePeriodLabel').text(label);
        loadDepartmentDocumentUploads(currentProjectId, period, $('#uploadDepartment').val() || '');
    });

    $(document).on('click', '.period-option-type', function () {
        const period = $(this).data('period');
        const label = $(this).text();
        typeUploadsperiod = period;
        $('#typePeriodLabel').text(label);
        loadDocumentTypeUploads(currentProjectId, period);
    });

    // Initialize Dashboard
    // In your initializeDashboard function, add:
    async function initializeDashboard() {
        if (isInitialized) return;
        isInitialized = true;
        const selectedDeptId = $('#uploadDepartment').val() || '';
        
        initializeHeaderProjectSelect();
        initializeRecentActivityDepartment();
        initializeUploadDepartment();
        initializeDonorVendorSection();
        
        await loadCurrentProject();
    
        // Load storage data
        await loadStorageData(currentProjectId);
        
        // Other load functions...
        loadDashboardStats(currentProjectId);
        loadRecentActivities(currentProjectId);
        loadFileStatus(currentProjectId);
        loadDocumentsFiltered(currentProjectId);
        loadDepartmentDocumentUploads(currentProjectId);
        safeSelect2Init('#dashboardDonor', initializeDonorSelect2);
        safeSelect2Init('#dashboardVendor', initializeVendorSelect2);
        loadDepartmentUploads(currentProjectId, currentPeriod);
        loadDocumentTypeUploads(currentProjectId, typeUploadsperiod);
        loadDepartmentDocumentUploads(currentProjectId, currentPeriod, selectedDeptId);
        loadDonorVendorProjects();
    
        // Dashboard card click handlers
        const dashboardCards = document.querySelectorAll('.dashboard-card');
        dashboardCards.forEach(card => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', function () {
                const status = this.getAttribute('data-status');
                redirectToDocumentsWithStatus(status);
            });
        });
    }

    function redirectToDocumentsWithStatus(status) {
        const baseUrl = window.location.origin;
        let url = `${baseUrl}/documents/list`;

        if (status && status !== 'all') {
            url += `?status=${encodeURIComponent(status)}`;
        }

        window.location.href = url;
    }

    // Start
    initializeDashboard();
});