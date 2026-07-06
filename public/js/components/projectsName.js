// (function ($) {
//     $(document).ready(function () {
//         const $select = $('#selectHeaderProject');
//         if (!$select.length) return;

//         const INITIAL_LIMIT = 10;
//         const cache = new Map(); // cache projects by ID

//         async function fetchProjects(search = '', limit = INITIAL_LIMIT) {
//             const res = await fetch(`/api/projects?search=${encodeURIComponent(search)}&limit=${limit}`, { credentials: 'include' });
//             const json = await res.json();
//             let items = [];
//             if (Array.isArray(json.data)) items = json.data;
//             else if (Array.isArray(json.results)) items = json.results;
//             else if (Array.isArray(json)) items = json;
//             else if (json.data && Array.isArray(json.data.data)) items = json.data.data;

//             items.forEach(p => cache.set(p._id, p)); // cache each project
//             return items;
//         }

//         $select.select2({
//             placeholder: 'Select project',
//             allowClear: true,
//             width: 'resolve',
//             ajax: {
//                 transport: async function (params, success, failure) {
//                     try {
//                         const search = params.data.term || '';
//                         const items = await fetchProjects(search);
//                         success(items);
//                     } catch (err) {
//                         failure(err);
//                     }
//                 },
//                 processResults: function (response) {
//                     const projects = Array.isArray(response) ? response : (response.data || []);
//                     return {
//                         results: projects.map(p => ({
//                             id: p._id,
//                             text: p.projectName || p.name || 'Untitled'
//                         }))
//                     };
//                 },
//                 cache: true
//             },
//             minimumInputLength: 0
//         });

//         (async function init() {
//             try {
//                 const items = await fetchProjects();
//                 items.forEach(p => $select.append(new Option(p.projectName || p.name || 'Untitled', p._id, false, false)));

//                 // Load saved project from session
//                 const sessionRes = await fetch(`/api/session/project`, { credentials: 'include' });
//                 const { selectedProject } = await sessionRes.json();

//                 if (selectedProject) {
//                     if (!cache.has(selectedProject)) {
//                         const res2 = await fetch(`/api/projects/${selectedProject}`, { credentials: 'include' });
//                         if (res2.ok) {
//                             const proj = await res2.json();
//                             const p = proj.data || proj;
//                             cache.set(p._id, p);
//                             $select.append(new Option(p.projectName || p.name || 'Untitled', p._id, false, true));
//                         }
//                     } else {
//                         $select.append(new Option(cache.get(selectedProject).projectName || cache.get(selectedProject).name || 'Untitled', selectedProject, false, true));
//                     }
//                     $select.val(selectedProject).trigger('change');
//                 }
//             } catch (err) {
//                 showToast("Error initializing projects: " + err.message, "error");
//             }
//         })();

//         $select.on('change', async function () {
//             const val = $(this).val();
//             const selectedText = $(this).find('option:selected').text();

//             window.selectedProjectId = val || null;
//             window.selectedProjectName = selectedText || null;

//             const addBtn = document.getElementById("btnAddFolder");

//             if (val) {
//                 if (addBtn) addBtn.classList.remove("disabled");
//                 loadFolders(null, [], val);
//             } else {
//                 if (addBtn) addBtn.classList.add("disabled");
//                 if (elements?.container) elements.container.innerHTML = "";
//                 setEmptyState(false);
//                 showNoProject(true);
//             }

//             // Save project session
//             try {
//                 await fetch(`/api/session/project`, {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     credentials: 'include',
//                     body: JSON.stringify({ projectId: val || null })
//                 });
//             } catch (err) {
//                 showToast("Failed to save project in session: " + err, "error");
//             }
//         });

//     });
// })(jQuery);
