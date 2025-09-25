// Simple SPA routing and state
let state = {
    token: localStorage.getItem('token'),
    user: null
};

let studentDashboardState = { viewingCourseId: null, viewingCourseTitle: null, viewingCourseSection: null, searchQuery: '' };
let searchTimeout = null; // Add debounce timeout

// Notification logic
let notifications = [];
let notificationsLoaded = false;

function setState(newState) {
    state = { ...state, ...newState };
    render();
}

async function fetchMe() {
    if (!state.token) return;
    const res = await fetch('http://localhost:4000/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + state.token }
    });
    if (res.ok) {
        const user = await res.json();
        setState({ user });
    } else {
        setState({ token: null, user: null });
        localStorage.removeItem('token');
    }
}

function render() {
    const app = document.getElementById('app');
    const mainHeader = document.getElementById('mainHeader');
    const body = document.body;
    if (!state.token) {
        if (mainHeader) mainHeader.style.display = 'none';
        body.classList.add('login-bg');
        app.innerHTML = `
            <div class="login-center-container">
                <h2 class="blend-vidya-heading">Welcome to Blend Vidya LMS</h2>
                <div>
                    <h3 style="text-align:center; margin-bottom: 1.2em;">LMS Login</h3>
                    <form id="loginForm">
                        <input type="email" name="email" placeholder="Email" required><br>
                        <input type="password" name="password" placeholder="Password" required><br>
                        <button type="submit">Login</button>
                    </form>
                    <p>or <a href="#register" id="toRegister">Register</a></p>
                    <div id="loginError" style="color:red;"></div>
                </div>
            </div>
            <footer style='background: #f7faff; color: #7f53ac; text-align: center; padding: 1.2em 0; font-size: 1.1em; border-top: 1.5px solid #e0c3fc; margin-top: 2em;'>
                <strong>Contact Us:</strong><br>
                Sunil: 9951399670 &nbsp;|&nbsp; Bharat Sai: 9676504372 &nbsp;|&nbsp; Tejaswini: 7396846750 &nbsp;|&nbsp; Pavan Sai: 8688285616
            </footer>
        `;
        document.getElementById('loginForm').onsubmit = async e => {
            e.preventDefault();
            const form = e.target;
            const res = await fetch('http://localhost:4000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: form.email.value,
                    password: form.password.value
                })
            });
            if (res.ok) {
                const data = await res.json();
                state.token = data.token;
                state.user = data.user;
                studentDashboardState = {};
                render();
            } else {
                document.getElementById('loginError').textContent = 'Login failed';
            }
        };
        document.getElementById('toRegister').onclick = e => {
            e.preventDefault();
            window.location.hash = '#register';
            renderRegister();
        };
        return;
    } else {
        if (mainHeader) mainHeader.style.display = '';
        body.classList.remove('login-bg');
    }
    if (!state.user) {
        fetchMe();
        app.innerHTML = '<p>Loading...</p>';
        return;
    }
    // Role-based dashboard
    app.innerHTML = `
        <h2>Welcome, ${state.user.name} (${state.user.role})</h2>
        <div id="dashboard"></div>
    `;
    renderDashboard();
}

function renderRegister() {
    const app = document.getElementById('app');
    const body = document.body;
    body.classList.add('login-bg');
    app.innerHTML = `
        <div class="login-center-container">
            <h2 class="blend-vidya-heading">Welcome to Blend Vidya LMS</h2>
            <div>
                <h3 style="text-align:center; margin-bottom: 1.2em;">LMS Register</h3>
                <form id="registerForm">
                    <input type="text" name="name" placeholder="Name" required><br>
                    <input type="email" name="email" placeholder="Email" required><br>
                    <input type="password" name="password" placeholder="Password" required><br>
                    <select name="role" required>
                        <option value="student">Student</option>
                        <option value="instructor">Instructor</option>
                    </select><br>
                    <button type="submit">Register</button>
                </form>
                <p>or <a href="#login" id="toLogin">Login</a></p>
                <div id="registerError" style="color:red;"></div>
            </div>
        </div>
    `;
    document.getElementById('registerForm').onsubmit = async e => {
        e.preventDefault();
        const form = e.target;
        const res = await fetch('http://localhost:4000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: form.name.value,
                email: form.email.value,
                password: form.password.value,
                role: form.role.value
            })
        });
        if (res.ok) {
            const data = await res.json();
            state.token = data.token;
            state.user = data.user;
            studentDashboardState = {};
            render();
        } else {
            document.getElementById('registerError').textContent = 'Registration failed';
        }
    };
    document.getElementById('toLogin').onclick = e => {
        e.preventDefault();
        window.location.hash = '#login';
        render();
    };
}

function renderDashboard() {
    const dash = document.getElementById('dashboard');
    // Centered Blend Vidya LMS title
    let lmsTitleHtml = `
        <div class="lms-title-container">
            <h2 class="lms-title">Blend Vidya LMS</h2>
        </div>
    `;
    if (state.user.role === 'admin') {
        dash.innerHTML = lmsTitleHtml + `
            <div class="user-action-bar"><button class="btn btn-logout" onclick="logout()">Logout</button></div>
            <h3>Admin Panel</h3>
            <div id="adminUsers"></div>
            <div id="adminCourses"></div>
        `;
        renderAdminPanel();
    } else if (state.user.role === 'instructor') {
        dash.innerHTML = lmsTitleHtml + `
            <div class="welcome-banner">Welcome, ${state.user.name} (Instructor)</div>
            <h3 style="text-align:center; margin-bottom: 1.5em;">Instructor Dashboard</h3>
            <div id="instructorCourses"></div>
            <div id="instructorCourseDetail"></div>
        `;
        renderInstructorDashboard();
    } else if (state.user.role === 'student') {
        dash.innerHTML = lmsTitleHtml + `
            <div class="welcome-banner">Welcome, ${state.user.name} (Student)</div>
            <h3 style="text-align:center; margin-bottom: 1.5em;">Student Dashboard</h3>
            <div id="studentCourses"></div>
            <div id="studentAssignments"></div>
            <div id="studentQuizzes"></div>
            <div id="studentProgress"></div>
            <div id="studentGrades"></div>
        `;
        renderStudentDashboard();
    }
}

async function renderStudentDashboard() {
    // Always use fresh data
    studentDashboardState.originalMyCourses = undefined;
    studentDashboardState.originalNotEnrolled = undefined;
    if (studentDashboardState.viewingCourseId) {
        await renderStudentCourseDetail(studentDashboardState.viewingCourseId, studentDashboardState.viewingCourseTitle);
        return;
    }
    // Enrolled courses
    const myCoursesRes = await fetch('http://localhost:4000/api/my-courses', {
        headers: { 'Authorization': 'Bearer ' + state.token }
    });
    const myCourses = await myCoursesRes.json();
    // Available courses to enroll
    const allCoursesRes = await fetch('http://localhost:4000/api/courses');
    const allCourses = await allCoursesRes.json();
    const notEnrolled = allCourses.filter(c => !myCourses.some(mc => mc.id === c.id));

    // Store original data for filtering (always fresh)
    studentDashboardState.originalMyCourses = myCourses;
    studentDashboardState.originalNotEnrolled = notEnrolled;

    // --- Search Bar ---
    let searchHtml = `
    <div class="search-bar-container">
        <span class="search-bar-icon">🔍</span>
        <input type="text" id="studentCourseSearch" class="search-bar-input" placeholder="Search courses..." value="${studentDashboardState.searchQuery || ''}">
        <div id="searchSuggestions" class="search-suggestions" style="display: none;"></div>
    </div>
    `;

    // Filter courses by search query
    const query = (studentDashboardState.searchQuery || '').toLowerCase();
    const filteredMyCourses = (studentDashboardState.originalMyCourses || myCourses).filter(c => c.title.toLowerCase().includes(query) || (c.description && c.description.toLowerCase().includes(query)));
    const filteredNotEnrolled = (studentDashboardState.originalNotEnrolled || notEnrolled).filter(c => c.title.toLowerCase().includes(query) || (c.description && c.description.toLowerCase().includes(query)));

    let html = `<div class="student-dashboard-section"><h4>My Courses</h4><div class="course-list">`;
    filteredMyCourses.forEach(c => {
        const imgSrc = c.image || 'https://via.placeholder.com/120x80?text=Course';
        html += `
            <div class="course-card">
                <img class="course-image" src="${imgSrc}" alt="Course Image">
                <div class="card-body">
                    <h5>${c.title}</h5>
                    <p class="course-description">${c.description ? c.description : ''}</p>
                    <button class="btn btn-primary" onclick="viewStudentCourse(${c.id}, '${c.title.replace(/'/g, "\'")}')">View</button>
                </div>
            </div>
        `;
    });
    html += `</div></div>`;

    let availHtml = `<div class="student-dashboard-section"><h4>Available Courses</h4><div class="course-list">`;
    filteredNotEnrolled.forEach(c => {
        const imgSrc = c.image || 'https://via.placeholder.com/120x80?text=Course';
        availHtml += `
            <div class="course-card">
                <img class="course-image" src="${imgSrc}" alt="Course Image">
                <div class="card-body">
                    <h5>${c.title}</h5>
                    <button class="btn btn-success" onclick="enrollCourse(${c.id})">Enroll</button>
                </div>
            </div>
        `;
    });
    availHtml += `</div></div>`;
    
    // Only update the content, not the search bar
    const studentCoursesDiv = document.getElementById('studentCourses');
    if (!studentCoursesDiv.querySelector('.search-bar-container')) {
        // First time rendering - include search bar
        studentCoursesDiv.innerHTML = searchHtml + html + availHtml;
    } else {
        // Subsequent renders - only update the course lists
        const searchBar = studentCoursesDiv.querySelector('.search-bar-container');
        studentCoursesDiv.innerHTML = '';
        studentCoursesDiv.appendChild(searchBar);
        studentCoursesDiv.insertAdjacentHTML('beforeend', html + availHtml);
    }

    // Add event listener for search bar with debouncing
    setTimeout(() => {
        const searchInput = document.getElementById('studentCourseSearch');
        if (searchInput && !searchInput.hasAttribute('data-listener-added')) {
            searchInput.setAttribute('data-listener-added', 'true');
            searchInput.oninput = function(e) {
                const query = e.target.value.toLowerCase();
                studentDashboardState.searchQuery = e.target.value;
                
                // Show suggestions immediately
                showSearchSuggestions(query);
                
                // Clear previous timeout
                if (searchTimeout) {
                    clearTimeout(searchTimeout);
                }
                
                // Set new timeout for debounced search
                searchTimeout = setTimeout(() => {
                    updateStudentCourseResults();
                }, 300); // 300ms delay
            };
            
            // Handle focus and blur for suggestions
            searchInput.onfocus = function() {
                const query = this.value.toLowerCase();
                if (query.length > 0) {
                    showSearchSuggestions(query);
                }
            };
            
            searchInput.onblur = function() {
                // Hide suggestions after a small delay to allow clicking
                setTimeout(() => {
                    hideSearchSuggestions();
                }, 200);
            };
        }
    }, 0);

    // Remove assignments, quizzes, progress, grades from main dashboard
    document.getElementById('studentAssignments').innerHTML = '';
    document.getElementById('studentQuizzes').innerHTML = '';
    document.getElementById('studentProgress').innerHTML = '';
}

// New function to update only the course results without re-rendering the search bar
function updateStudentCourseResults() {
    const query = (studentDashboardState.searchQuery || '').toLowerCase();
    const filteredMyCourses = (studentDashboardState.originalMyCourses || []).filter(c => c.title.toLowerCase().includes(query) || (c.description && c.description.toLowerCase().includes(query)));
    const filteredNotEnrolled = (studentDashboardState.originalNotEnrolled || []).filter(c => c.title.toLowerCase().includes(query) || (c.description && c.description.toLowerCase().includes(query)));

    let html = `<div class="student-dashboard-section"><h4>My Courses</h4><div class="course-list">`;
    filteredMyCourses.forEach(c => {
        const imgSrc = c.image || 'https://via.placeholder.com/120x80?text=Course';
        html += `
            <div class="course-card">
                <img class="course-image" src="${imgSrc}" alt="Course Image">
                <div class="card-body">
                    <h5>${c.title}</h5>
                    <p class="course-description">${c.description ? c.description : ''}</p>
                    <button class="btn btn-primary" onclick="viewStudentCourse(${c.id}, '${c.title.replace(/'/g, "\'")}')">View</button>
                </div>
            </div>
        `;
    });
    html += `</div></div>`;

    let availHtml = `<div class="student-dashboard-section"><h4>Available Courses</h4><div class="course-list">`;
    filteredNotEnrolled.forEach(c => {
        const imgSrc = c.image || 'https://via.placeholder.com/120x80?text=Course';
        availHtml += `
            <div class="course-card">
                <img class="course-image" src="${imgSrc}" alt="Course Image">
                <div class="card-body">
                    <h5>${c.title}</h5>
                    <button class="btn btn-success" onclick="enrollCourse(${c.id})">Enroll</button>
                </div>
            </div>
        `;
    });
    availHtml += `</div></div>`;

    // Update only the course sections, preserving the search bar
    const studentCoursesDiv = document.getElementById('studentCourses');
    const searchBar = studentCoursesDiv.querySelector('.search-bar-container');
    studentCoursesDiv.innerHTML = '';
    studentCoursesDiv.appendChild(searchBar);
    studentCoursesDiv.insertAdjacentHTML('beforeend', html + availHtml);
}

// Function to show search suggestions
function showSearchSuggestions(query) {
    const suggestionsDiv = document.getElementById('searchSuggestions');
    if (!suggestionsDiv) return;
    
    if (query.length === 0) {
        hideSearchSuggestions();
        return;
    }
    
    const allCourses = [
        ...(studentDashboardState.originalMyCourses || []),
        ...(studentDashboardState.originalNotEnrolled || [])
    ];
    
    const matchingCourses = allCourses.filter(c => 
        c.title.toLowerCase().includes(query)
    ).slice(0, 5); // Limit to 5 suggestions
    
    if (matchingCourses.length === 0) {
        hideSearchSuggestions();
        return;
    }
    
    let suggestionsHtml = '';
    matchingCourses.forEach(course => {
        suggestionsHtml += `
            <div class="suggestion-item" onclick="selectSuggestion('${course.title.replace(/'/g, "\\'")}')">
                ${course.title}
            </div>
        `;
    });
    
    suggestionsDiv.innerHTML = suggestionsHtml;
    suggestionsDiv.style.display = 'block';
}

// Function to hide search suggestions
function hideSearchSuggestions() {
    const suggestionsDiv = document.getElementById('searchSuggestions');
    if (suggestionsDiv) {
        suggestionsDiv.style.display = 'none';
    }
}

// Function to handle selecting a suggestion
window.selectSuggestion = function(courseTitle) {
    const searchInput = document.getElementById('studentCourseSearch');
    if (searchInput) {
        searchInput.value = courseTitle;
        studentDashboardState.searchQuery = courseTitle;
        updateStudentCourseResults();
        hideSearchSuggestions();
    }
};

window.enrollCourse = async function(courseId) {
    // Disable the button immediately
    const btns = document.querySelectorAll(`button[onclick="enrollCourse(${courseId})"]`);
    btns.forEach(btn => {
        btn.disabled = true;
        btn.textContent = 'Enrolling...';
    });
    // Prevent duplicate enrollments in UI
    if (!studentDashboardState._enrollingCourses) studentDashboardState._enrollingCourses = new Set();
    if (studentDashboardState._enrollingCourses.has(courseId)) return;
    studentDashboardState._enrollingCourses.add(courseId);
    await fetch(`http://localhost:4000/api/courses/${courseId}/enroll`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + state.token }
    });
    // Remove from available and add to enrolled in state
    if (studentDashboardState.originalNotEnrolled) {
        const idx = studentDashboardState.originalNotEnrolled.findIndex(c => c.id === courseId);
        if (idx !== -1) {
            const course = studentDashboardState.originalNotEnrolled.splice(idx, 1)[0];
            if (!studentDashboardState.originalMyCourses) studentDashboardState.originalMyCourses = [];
            studentDashboardState.originalMyCourses.push(course);
        }
    }
    // Clean up
    studentDashboardState._enrollingCourses.delete(courseId);
    updateStudentCourseResults();
};

window.viewStudentCourse = function(courseId, courseTitle) {
    console.log('viewStudentCourse called with:', courseId, courseTitle); // Debug log
    studentDashboardState.viewingCourseId = courseId;
    studentDashboardState.viewingCourseTitle = courseTitle;
    console.log('Updated studentDashboardState:', studentDashboardState); // Debug log
    renderStudentDashboard();
};

async function renderStudentCourseDetail(courseId, courseTitle) {
    console.log('Rendering course detail for:', courseId, courseTitle); // Debug log
    
    const section = studentDashboardState.viewingCourseSection || 'overview';
    let detailsHtml = '';
    if (section === 'overview') {
        detailsHtml += `<button onclick="backToStudentCourses()" class="btn btn-secondary">← Back to My Courses</button>`;
        detailsHtml += `<div class='selected-course-section'><h4>${courseTitle || 'Course'} - Assignments & Quizzes</h4>`;
    } else {
        detailsHtml += `<button onclick="backToStudentCourses()" class="btn btn-secondary">← Back to Course</button>`;
        detailsHtml += `<div class='selected-course-section'>`;
    }
    try {
        if (section === 'overview') {
            // Assignments
            console.log('Fetching assignments for course:', courseId); // Debug log
            const assignmentsRes = await fetch(`http://localhost:4000/api/courses/${courseId}/assignments`, {
                headers: { 'Authorization': 'Bearer ' + state.token }
            });
            
            if (!assignmentsRes.ok) {
                throw new Error(`Failed to fetch assignments: ${assignmentsRes.status}`);
            }
            
            const assignments = await assignmentsRes.json();
            console.log('Assignments fetched:', assignments); // Debug log
            
            // Get student's submissions to check which assignments are completed
            const mySubmissionsRes = await fetch('http://localhost:4000/api/my-submissions', {
                headers: { 'Authorization': 'Bearer ' + state.token }
            });
            
            if (!mySubmissionsRes.ok) {
                throw new Error(`Failed to fetch submissions: ${mySubmissionsRes.status}`);
            }
            
            const mySubmissions = await mySubmissionsRes.json();
            console.log('Submissions fetched:', mySubmissions); // Debug log
            
            // Separate completed and new assignments
            const completedAssignments = [];
            const newAssignments = [];
            
            assignments.forEach(assignment => {
                const submission = mySubmissions.find(sub => sub.assignment_id === assignment.id);
                if (submission) {
                    completedAssignments.push({ ...assignment, submission });
                } else {
                    newAssignments.push(assignment);
                }
            });
            
            let aHtml = `<h5 style="font-size: 1.5em; color: #7f53ac; margin: 1.5rem 0 1rem 0;">📚 Assignments</h5>`;
            
            // New Assignments Section
            if (newAssignments.length > 0) {
                aHtml += `<h6 style="color: #ff6b6b; margin: 1rem 0 0.5rem 0;">🆕 New Assignments (${newAssignments.length})</h6>`;
                aHtml += `<div class="cards-container">`;
                newAssignments.forEach(a => {
                    aHtml += `
                        <div class="assignment-card">
                            <h4>${a.title}</h4>
                            ${a.description ? `<p>${a.description}</p>` : ''}
                            <div class="assignment-meta">
                                ${a.deadline ? `<span>📅 Due: ${new Date(a.deadline).toLocaleDateString()}</span>` : ''}
                                ${a.file_path ? `<span>📎 Has File</span>` : ''}
                                ${a.link ? `<span>🔗 Has Link</span>` : ''}
                                <span class="status-badge status-pending">⏳ Pending</span>
                            </div>
                            <div class="card-actions">
                                ${a.file_path ? `<a href="http://localhost:4000${a.file_path}" target="_blank" class="btn btn-secondary">📥 Download</a>` : ''}
                                ${a.link ? `<a href="${a.link}" target="_blank" class="btn btn-secondary">🔗 External Link</a>` : ''}
                                <button onclick="submitAssignment(${a.id})" class="btn btn-primary">📤 Submit</button>
                            </div>
                        </div>`;
                });
                aHtml += `</div>`;
            }
            
            // Completed Assignments Section
            if (completedAssignments.length > 0) {
                aHtml += `<h6 style="color: #4caf50; margin: 1rem 0 0.5rem 0;">✅ Completed Assignments (${completedAssignments.length})</h6>`;
                aHtml += `<div class="cards-container">`;
                completedAssignments.forEach(a => {
                    const gradeDisplay = a.submission.grade ? 
                        `<div class="score-display">Grade: ${a.submission.grade}</div>` : 
                        '<span class="status-badge status-pending">Ungraded</span>';
                    
                    aHtml += `
                        <div class="assignment-card">
                            <h4>${a.title}</h4>
                            ${a.description ? `<p>${a.description}</p>` : ''}
                            <div class="assignment-meta">
                                <span class="status-badge status-submitted">✅ Submitted</span>
                                <span>📅 Submitted: ${new Date(a.submission.submitted_at).toLocaleDateString()}</span>
                                ${a.submission.file_path ? `<span>📎 File Submitted</span>` : ''}
                            </div>
                            ${gradeDisplay}
                            <div class="card-actions">
                                ${a.submission.file_path ? `<a href="http://localhost:4000${a.submission.file_path}" target="_blank" class="btn btn-secondary">📥 View Submission</a>` : ''}
                            </div>
                        </div>`;
                });
                aHtml += `</div>`;
            }
            
            if (newAssignments.length === 0 && completedAssignments.length === 0) {
                aHtml += '<div class="assignment-card"><p>No assignments available for this course.</p></div>';
            }
            
            detailsHtml += aHtml;

            // Quizzes
            console.log('Fetching quizzes for course:', courseId); // Debug log
            const quizzesRes = await fetch(`http://localhost:4000/api/courses/${courseId}/quizzes`, {
                headers: { 'Authorization': 'Bearer ' + state.token }
            });
            
            if (!quizzesRes.ok) {
                throw new Error(`Failed to fetch quizzes: ${quizzesRes.status}`);
            }
            
            const quizzes = await quizzesRes.json();
            console.log('Quizzes fetched:', quizzes); // Debug log
            
            // Fetch student's quiz submissions for this course
            const myQuizSubsRes = await fetch('http://localhost:4000/api/my-quiz-submissions', {
                headers: { 'Authorization': 'Bearer ' + state.token }
            });
            
            if (!myQuizSubsRes.ok) {
                throw new Error(`Failed to fetch quiz submissions: ${myQuizSubsRes.status}`);
            }
            
            const myQuizSubs = await myQuizSubsRes.json();
            console.log('Quiz submissions fetched:', myQuizSubs); // Debug log
            
            // Fetch all questions for all quizzes in this course to get total marks
            const quizQuestionCounts = {};
            await Promise.all(quizzes.map(async q => {
                const res = await fetch(`http://localhost:4000/api/quizzes/${q.id}/questions`, {
                    headers: { 'Authorization': 'Bearer ' + state.token }
                });
                if (res.ok) {
                    const questions = await res.json();
                    quizQuestionCounts[q.id] = questions.length;
                }
            }));
            
            // Separate completed and new quizzes
            const completedQuizzes = [];
            const newQuizzes = [];
            
            quizzes.forEach(quiz => {
                const submission = myQuizSubs.find(sub => sub.quiz_id === quiz.id);
                if (submission) {
                    completedQuizzes.push({ ...quiz, submission, questionCount: quizQuestionCounts[quiz.id] });
                } else {
                    newQuizzes.push({ ...quiz, questionCount: quizQuestionCounts[quiz.id] });
                }
            });
            
            let qHtml = `<h5 style="font-size: 1.5em; color: #7f53ac; margin: 1.5rem 0 1rem 0;">📝 Quizzes</h5>`;
            
            // New Quizzes Section
            if (newQuizzes.length > 0) {
                qHtml += `<h6 style="color: #ff6b6b; margin: 1rem 0 0.5rem 0;">🆕 New Quizzes (${newQuizzes.length})</h6>`;
                qHtml += `<div class="cards-container">`;
                newQuizzes.forEach(q => {
                    qHtml += `
                        <div class="quiz-card">
                            <h4>${q.title}</h4>
                            <div class="quiz-meta">
                                <span class="status-badge status-pending">⏳ Available</span>
                                ${q.questionCount ? `<span>📊 ${q.questionCount} Questions</span>` : ''}
                            </div>
                            <div class="card-actions">
                                <button onclick="takeQuiz(${q.id})" class="btn btn-success">📝 Take Quiz</button>
                            </div>
                        </div>`;
                });
                qHtml += `</div>`;
            }
            
            // Completed Quizzes Section
            if (completedQuizzes.length > 0) {
                qHtml += `<h6 style="color: #4caf50; margin: 1rem 0 0.5rem 0;">✅ Completed Quizzes (${completedQuizzes.length})</h6>`;
                qHtml += `<div class="cards-container">`;
                // Fetch ranks for all completed quizzes in parallel
                const quizRanks = await Promise.all(completedQuizzes.map(async q => {
                    try {
                        const res = await fetch(`http://localhost:4000/api/quizzes/${q.id}/my-rank`, {
                            headers: { 'Authorization': 'Bearer ' + state.token }
                        });
                        if (!res.ok) return null;
                        return await res.json();
                    } catch {
                        return null;
                    }
                }));
                completedQuizzes.forEach((q, idx) => {
                    const scoreDisplay = `<div class="score-display">Score: ${q.submission.score}${q.questionCount ? '/' + q.questionCount : ''}</div>`;
                    let rankDisplay = '';
                    const rankInfo = quizRanks[idx];
                    if (rankInfo && rankInfo.rank && rankInfo.total) {
                        rankDisplay = `<div class="rank-display">🏆 Rank: ${rankInfo.rank} of ${rankInfo.total}</div>`;
                    }
                    qHtml += `
                        <div class="quiz-card">
                            <h4>${q.title}</h4>
                            <div class="quiz-meta">
                                <span class="status-badge status-submitted">✅ Completed</span>
                                ${q.questionCount ? `<span>📅 ${q.questionCount} Questions</span>` : ''}
                                <span>📅 ${new Date(q.submission.submitted_at).toLocaleDateString()}</span>
                            </div>
                            ${scoreDisplay}
                            ${rankDisplay}
                            <div class="card-actions">
                                <button onclick="reviewQuiz(${q.id})" class="btn btn-primary">📋 Review</button>
                            </div>
                        </div>`;
                });
                qHtml += `</div>`;
            }
            
            if (newQuizzes.length === 0 && completedQuizzes.length === 0) {
                qHtml += '<div class="quiz-card"><p>No quizzes available for this course.</p></div>';
            }
            
            detailsHtml += qHtml;

            // Progress
            console.log('Fetching progress for course:', courseId); // Debug log
            try {
                const progressRes = await fetch(`http://localhost:4000/api/courses/${courseId}/progress`, {
                    headers: { 'Authorization': 'Bearer ' + state.token }
                });
                
                if (progressRes.ok) {
                    const progress = await progressRes.json();
                    console.log('Progress fetched:', progress); // Debug log
                    detailsHtml += `<h5 style="font-size: 1.5em; color: #7f53ac; margin: 1.5rem 0 1rem 0;">📊 Course Progress</h5>`;
                    detailsHtml += `<div class="progress-card" style="background: #f7faff; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">`;
                    detailsHtml += `<p style="font-size: 1.1em; margin: 0;"><strong>${progress.percent}% complete</strong> (${progress.completed}/${progress.total} items completed)</p>`;
                    detailsHtml += `<div style="background: #e0e0e0; height: 20px; border-radius: 10px; margin-top: 0.5rem; overflow: hidden;">`;
                    detailsHtml += `<div style="background: linear-gradient(90deg, #7f53ac 60%, #647dee 100%); height: 100%; width: ${progress.percent}%; transition: width 0.3s ease;"></div>`;
                    detailsHtml += `</div></div>`;
                }
            } catch (err) {
                console.log('Progress fetch failed:', err); // Debug log
            }

            // Grades
            console.log('Fetching grades for course:', courseId); // Debug log
            try {
                const gradesRes = await fetch(`http://localhost:4000/api/courses/${courseId}/grades`, {
                    headers: { 'Authorization': 'Bearer ' + state.token }
                });
                
                if (gradesRes.ok) {
                    const grades = await gradesRes.json();
                    console.log('Grades fetched:', grades); // Debug log
                    detailsHtml += `<h5 style="font-size: 1.5em; color: #7f53ac; margin: 1.5rem 0 1rem 0;">📋 Grades</h5>`;
                    detailsHtml += `<div class="grades-container">`;
                    if (!grades || grades.length === 0) {
                        detailsHtml += '<div class="grade-card" style="background: #f7faff; padding: 1rem; border-radius: 8px; margin-bottom: 0.5rem;"><p style="margin: 0; color: #666;">No grades available yet.</p></div>';
                    } else {
                        grades.forEach(g => {
                            const actualMarks = g.grade !== undefined && g.grade !== null ? g.grade : 'Not submitted';
                            
                            // Simple color coding based on the actual marks (assuming typical grading scale)
                            const gradeColor = g.grade !== undefined && g.grade !== null ? 
                                (g.grade >= 90 ? '#4caf50' : g.grade >= 80 ? '#ff9800' : g.grade >= 70 ? '#ff5722' : '#f44336') : '#666';
                            
                            detailsHtml += `
                                <div class="grade-card" style="background: #f7faff; padding: 1rem; border-radius: 8px; margin-bottom: 0.5rem; border-left: 4px solid ${gradeColor};">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div>
                                            <span style="font-weight: 600; font-size: 1.1em;">${g.title}</span>
                                            <br>
                                            <span style="color: #666; font-size: 0.9em;">${g.type || 'Assignment'}</span>
                                        </div>
                                        <div style="text-align: right;">
                                            <span style="font-size: 1.3em; font-weight: bold; color: ${gradeColor};">
                                                ${actualMarks}
                                            </span>
                                        </div>
                                    </div>
                                </div>`;
                        });
                    }
                    detailsHtml += `</div>`;
                }
            } catch (err) {
                console.log('Grades fetch failed:', err); // Debug log
            }
        } else if (section === 'quiz') {
            // Quiz UI is handled by takeQuiz/reviewQuiz, so just return
            return;
        } else if (section === 'assignment') {
            // Assignment UI is handled by submitAssignment, so just return
            return;
        }
    } catch (err) {
        console.error('Error in renderStudentCourseDetail:', err); // Debug log
        detailsHtml += `<p style="color:red">Failed to load course content: ${err.message}</p>`;
    }
    detailsHtml += '</div>';
    
    console.log('Updating studentCourses element with:', detailsHtml); // Debug log
    document.getElementById('studentCourses').innerHTML = detailsHtml;
    document.getElementById('studentAssignments').innerHTML = '';
    document.getElementById('studentQuizzes').innerHTML = '';
    document.getElementById('studentProgress').innerHTML = '';
}

window.backToStudentCourses = function() {
    studentDashboardState.viewingCourseId = null;
    studentDashboardState.viewingCourseTitle = null;
    studentDashboardState.viewingCourseSection = null;
    renderStudentDashboard();
};

window.submitAssignment = function(assignmentId) {
    // Show a modal for file upload and submission
    const modal = document.createElement('div');
    modal.className = 'modal-upload';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Submit Assignment</h3>
            <form id="assignmentSubmitForm">
                <input type="file" name="file" required><br><br>
                <button type="submit">Submit</button>
                <button type="button" id="cancelAssignmentSubmit">Cancel</button>
            </form>
            <div id="assignmentSubmitStatus"></div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('cancelAssignmentSubmit').onclick = () => document.body.removeChild(modal);
    document.getElementById('assignmentSubmitForm').onsubmit = async e => {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const statusDiv = document.getElementById('assignmentSubmitStatus');
        try {
            statusDiv.textContent = 'Submitting...';
            const response = await fetch(`http://localhost:4000/api/assignments/${assignmentId}/submit`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + state.token },
                body: formData
            });
            if (!response.ok) {
                throw new Error('Failed to submit assignment');
            }
            statusDiv.textContent = 'Assignment submitted successfully!';
            setTimeout(() => {
                document.body.removeChild(modal);
                // Refresh the course detail view
                renderStudentDashboard();
            }, 1000);
        } catch (err) {
            statusDiv.textContent = 'Error: ' + err.message;
        }
    };
};

window.takeQuiz = async function(quizId) {
    // Show a modal for taking the quiz
    const modal = document.createElement('div');
    modal.className = 'modal-upload';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:800px;text-align:left;max-height:90vh;overflow-y:auto;">
            <h3 style="margin-bottom:1em;">Take Quiz</h3>
            <form id="quizTakeForm"><div style='text-align:center;'>Loading questions...</div></form>
            <div id="quizTakeStatus" style="margin-top:1em;color:#d32f2f;"></div>
            <button type="button" id="closeQuizTake" style="margin-top:1em;">Cancel</button>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('closeQuizTake').onclick = () => {
        document.body.removeChild(modal);
        renderStudentDashboard();
    };
    // Fetch questions
    try {
        const questionsRes = await fetch(`http://localhost:4000/api/quizzes/${quizId}/questions`, {
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
        if (!questionsRes.ok) throw new Error('Failed to load quiz questions');
        const questions = await questionsRes.json();
        let html = '';
        questions.forEach((q, idx) => {
            html += `<div class='quiz-review-block' style='margin-bottom:1.5em;padding-bottom:0.5em;border-bottom:1px solid #eee;'>`;
            html += `<div style='font-weight:600;margin-bottom:0.7em;font-size:1.1em;'>Q${idx+1}: ${q.question_text || q.text || 'Question not found'}</div>`;
            if (q.question_type === 'mcq' && q.options) {
                q.options.forEach((opt, i) => {
                    html += `<label style='display:block;margin-bottom:0.5em;font-size:1em;cursor:pointer;'><input type='radio' name='q_${q.id}' value='${i+1}' required style='margin-right:0.7em;transform:scale(1.3);vertical-align:middle;'> ${i+1}. ${opt}</label>`;
                });
            } else if (q.question_type === 'numerical') {
                html += `<input type='number' name='q_${q.id}' required placeholder='Enter number' style='width:100%;padding:0.7em;margin-bottom:0.7em;font-size:1em;'>`;
            } else if (q.question_type === 'truefalse') {
                html += `<label style='margin-right:2em;font-size:1em;cursor:pointer;'><input type='radio' name='q_${q.id}' value='true' required style='margin-right:0.7em;transform:scale(1.3);vertical-align:middle;'> True</label>`;
                html += `<label style='font-size:1em;cursor:pointer;'><input type='radio' name='q_${q.id}' value='false' required style='margin-right:0.7em;transform:scale(1.3);vertical-align:middle;'> False</label>`;
            } else {
                html += `<input type='text' name='q_${q.id}' required placeholder='Enter answer' style='width:100%;padding:0.7em;margin-bottom:0.7em;font-size:1em;'>`;
            }
            html += '</div>';
        });
        html += `<button type='submit' style='margin-top:1.5em;background:#7f53ac;color:#fff;padding:0.9em 2.5em;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:1.1em;'>Submit Quiz</button>`;
        document.getElementById('quizTakeForm').innerHTML = html;
        document.getElementById('quizTakeForm').onsubmit = async e => {
            e.preventDefault();
            const form = e.target;
            const formData = new FormData(form);
            const answers = {};
            questions.forEach(q => {
                answers[q.id] = formData.get('q_' + q.id);
            });
            // Calculate score (client-side, for instant feedback)
            let score = 0;
            questions.forEach(q => {
                if (q.question_type === 'mcq' && answers[q.id] == q.answer) score++;
                else if (q.question_type === 'truefalse' && answers[q.id] && answers[q.id].toString().toLowerCase() === q.answer.toString().toLowerCase()) score++;
                else if (q.question_type === 'numerical' && answers[q.id] && Number(answers[q.id]) == Number(q.answer)) score++;
                else if (q.question_type !== 'mcq' && q.question_type !== 'truefalse' && q.question_type !== 'numerical' && answers[q.id] && answers[q.id].toString().trim().toLowerCase() === q.answer.toString().trim().toLowerCase()) score++;
            });
            const statusDiv = document.getElementById('quizTakeStatus');
            try {
                statusDiv.style.color = '#1976d2';
                statusDiv.textContent = 'Submitting...';
                const response = await fetch(`http://localhost:4000/api/quizzes/${quizId}/submit`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + state.token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ answers, score })
                });
                if (!response.ok) throw new Error('Failed to submit quiz');
                statusDiv.textContent = 'Quiz submitted successfully!';
                setTimeout(() => {
                    document.body.removeChild(modal);
                    renderStudentDashboard();
                }, 1000);
            } catch (err) {
                statusDiv.style.color = '#d32f2f';
                statusDiv.textContent = 'Error: ' + err.message;
            }
        };
    } catch (err) {
        document.getElementById('quizTakeForm').innerHTML = `<div style='color:#d32f2f;'>Error: ${err.message}</div>`;
    }
};

window.reviewQuiz = async function(quizId) {
    // Show a modal with quiz questions, user's answers, and correct answers
    const modal = document.createElement('div');
    modal.className = 'modal-upload';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:800px;text-align:left;max-height:90vh;overflow-y:auto;">
            <h3 style="margin-bottom:1em;">Quiz Review</h3>
            <div id="quizReviewContent">Loading...</div>
            <button type="button" id="closeQuizReview" style="margin-top:1em;">Close</button>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('closeQuizReview').onclick = () => {
        document.body.removeChild(modal);
        renderStudentDashboard();
    };
    // Fetch questions and user's submission
    try {
        const [questionsRes, submissionRes] = await Promise.all([
            fetch(`http://localhost:4000/api/quizzes/${quizId}/questions`, {
                headers: { 'Authorization': 'Bearer ' + state.token }
            }),
            fetch(`http://localhost:4000/api/my-quiz-submissions`, {
                headers: { 'Authorization': 'Bearer ' + state.token }
            })
        ]);
        if (!questionsRes.ok || !submissionRes.ok) throw new Error('Failed to load quiz review');
        const questions = await questionsRes.json();
        const submissions = await submissionRes.json();
        const submission = submissions.find(s => s.quiz_id === quizId);
        if (!submission) throw new Error('No submission found for this quiz');
        const answers = submission.answers ? JSON.parse(submission.answers) : {};
        let html = '';
        questions.forEach((q, idx) => {
            html += `<div class='quiz-review-block' style='margin-bottom:1.2em;'>`;
            html += `<div style='font-weight:600;margin-bottom:0.5em;'>Q${idx+1}: ${q.question_text || q.text || 'Question not found'}</div>`;
            let userAns = answers[q.id] || 'N/A';
            let correctAns = q.answer;
            let isCorrect = false;
            if (q.question_type === 'mcq') {
                html += '<ul style="margin-bottom:0.5em;">';
                (q.options || []).forEach((opt, i) => {
                    let selected = (userAns == i+1);
                    let correct = (q.answer == i+1 || q.answer == i+1+'' || q.answer == opt);
                    html += `<li style='${selected ? 'font-weight:bold;text-decoration:underline;' : ''}${correct ? 'color:#388e3c;' : ''}'>${i+1}. ${opt}${selected ? ' (Your answer)' : ''}${correct ? ' (Correct)' : ''}</li>`;
                    if(selected && correct) isCorrect = true;
                });
                html += '</ul>';
                if (!isCorrect && userAns !== 'N/A') {
                    html += `<div style='color:#d32f2f;font-weight:500;'>Your answer: ${userAns} (Incorrect)</div>`;
                }
            } else if (q.question_type === 'truefalse') {
                isCorrect = userAns.toString().toLowerCase() === correctAns.toString().toLowerCase();
                html += `<div>Your answer: <b>${userAns}</b> <span style='color:${isCorrect ? '#388e3c' : '#d32f2f'};'>${isCorrect ? '✔' : '✖'}</span></div>`;
                html += `<div>Correct answer: <b>${correctAns}</b></div>`;
            } else if (q.question_type === 'numerical') {
                isCorrect = Number(userAns) == Number(correctAns);
                html += `<div>Your answer: <b>${userAns}</b> <span style='color:${isCorrect ? '#388e3c' : '#d32f2f'};'>${isCorrect ? '✔' : '✖'}</span></div>`;
                html += `<div>Correct answer: <b>${correctAns}</b></div>`;
            } else {
                isCorrect = userAns.toString().trim().toLowerCase() === correctAns.toString().trim().toLowerCase();
                html += `<div>Your answer: <b>${userAns}</b> <span style='color:${isCorrect ? '#388e3c' : '#d32f2f'};'>${isCorrect ? '✔' : '✖'}</span></div>`;
                html += `<div>Correct answer: <b>${correctAns}</b></div>`;
            }
            html += '</div>';
        });
        document.getElementById('quizReviewContent').innerHTML = html;
    } catch (err) {
        document.getElementById('quizReviewContent').innerHTML = `<div style='color:#d32f2f;'>Error: ${err.message}</div>`;
    }
};

window.selectSuggestion = function(courseTitle) {
    const searchInput = document.getElementById('studentCourseSearch');
    if (searchInput) {
        searchInput.value = courseTitle;
        studentDashboardState.searchQuery = courseTitle;
        updateStudentCourseResults();
        hideSearchSuggestions();
    }
};

async function renderInstructorDashboard() {
    // List instructor's courses
    const res = await fetch('http://localhost:4000/api/my-courses', {
        headers: { 'Authorization': 'Bearer ' + state.token }
    });
    const courses = await res.json();
    let html = `<div class="instructor-dashboard-section"><h2 class="section-title">My Courses</h2><div class="instructorCourseList">`;
    courses.forEach(c => {
        html += `<div class="instructorCourseCard" id="instructorCourseCard_${c.id}">
            <div class="card-body">
                <h3 class="course-title">${c.title}</h3>
                <button class="btn btn-primary manage-btn" onclick="toggleManageCourse(${c.id}, this)">Manage</button>
                <div class="manage-course-detail animated-panel" id="manageCourseDetail_${c.id}" style="display:none;"></div>
            </div>
        </div>`;
    });
    html += `</div></div>`;
    html += `<div class="create-course-bar"><button class="btn btn-success" onclick="showCreateCourse()">+ Create New Course</button></div>`;
    document.getElementById('instructorCourses').innerHTML = html;
}

window.toggleManageCourse = async function(courseId, btn) {
    // Collapse any other open manage panels
    document.querySelectorAll('.manage-course-detail').forEach(el => {
        if (el.id !== `manageCourseDetail_${courseId}`) {
            el.style.display = 'none';
            if (el.previousElementSibling && el.previousElementSibling.tagName === 'BUTTON') {
                el.previousElementSibling.textContent = 'Manage';
            }
        }
    });
    const detailDiv = document.getElementById(`manageCourseDetail_${courseId}`);
    if (detailDiv.style.display === 'block') {
        detailDiv.style.display = 'none';
        btn.textContent = 'Manage';
        return;
    }
    btn.textContent = 'Close';
    detailDiv.style.display = 'block';
    detailDiv.innerHTML = '<div style="padding:1em;text-align:center;">Loading...</div>';
    detailDiv.innerHTML = await getManageCourseHtml(courseId);
};

async function getManageCourseHtml(courseId) {
    try {
        // Assignments
        const assignmentsRes = await fetch(`http://localhost:4000/api/courses/${courseId}/assignments`, {
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
        
        if (!assignmentsRes.ok) {
            throw new Error(`Failed to fetch assignments: ${assignmentsRes.status}`);
        }
        
        const assignments = await assignmentsRes.json();
        let html = `<div class="manage-panel-content compact-panel">
            <div class="manage-section">
                <div class="manage-section-header">Assignments <button class='btn btn-xs btn-primary add-btn' onclick=\"showCreateAssignment(${courseId})\">+ Add</button></div>
                <div class="manage-list">`;
        if (assignments.length === 0) {
            html += `<div class="empty-msg">No assignments yet.</div>`;
        }
        assignments.forEach(a => {
            html += `<div class="manage-item compact-item">
                <span class="item-title">${a.title}</span>
                <div class="item-actions compact-actions">
                    <button class="btn btn-xs btn-secondary" onclick=\"viewSubmissions(${a.id}, ${courseId})\">Sub</button>
                    <button class="btn btn-xs btn-danger" onclick=\"deleteAssignment(${a.id}, ${courseId})\">Del</button>
                </div>
            </div>`;
        });
        html += `</div>
            </div>`;
        
        // Quizzes
        const quizzesRes = await fetch(`http://localhost:4000/api/courses/${courseId}/quizzes`, {
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
        
        if (!quizzesRes.ok) {
            throw new Error(`Failed to fetch quizzes: ${quizzesRes.status}`);
        }
        
        const quizzes = await quizzesRes.json();
        html += `<div class="manage-section">
                <div class="manage-section-header">Quizzes <button class='btn btn-xs btn-primary add-btn' onclick=\"showCreateQuiz(${courseId})\">+ Add</button></div>
                <div class="manage-list">`;
        if (quizzes.length === 0) {
            html += `<div class="empty-msg">No quizzes yet.</div>`;
        }
        quizzes.forEach(q => {
            html += `<div class="manage-item compact-item">
                <span class="item-title">${q.title}</span>
                <div class="item-actions compact-actions">
                    <button class="btn btn-xs btn-secondary" onclick=\"viewQuizSubmissions(${q.id}, ${courseId})\">Sub</button>
                    <button class="btn btn-xs btn-primary" onclick=\"showAddQuestion(${q.id}, ${courseId})\">Q</button>
                    <button class="btn btn-xs btn-danger" onclick=\"deleteQuiz(${q.id}, ${courseId})\">Del</button>
                </div>
            </div>`;
        });
        html += `</div>
            </div>
        </div>`;
        return html;
    } catch (error) {
        console.error('Error in getManageCourseHtml:', error);
        throw error; // Re-throw to be caught by restoreManagePanel
    }
}

window.showCreateCourse = function() {
    document.getElementById('instructorCourseDetail').innerHTML = `
        <h4>Create Course</h4>
        <form id="createCourseForm">
            <input type="text" name="title" placeholder="Title" required><br>
            <textarea name="description" placeholder="Description"></textarea><br>
            <button type="submit">Create</button>
        </form>
    `;
    document.getElementById('createCourseForm').onsubmit = async e => {
        e.preventDefault();
        const form = e.target;
        await fetch('http://localhost:4000/api/courses', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + state.token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: form.title.value, description: form.description.value })
        });
        renderInstructorDashboard();
        document.getElementById('instructorCourseDetail').innerHTML = '';
    };
};

window.showCreateAssignment = function(courseId) {
    document.getElementById(`manageCourseDetail_${courseId}`).innerHTML = `
        <h5>Create Assignment</h5>
        <form id="createAssignmentForm" enctype="multipart/form-data">
            <input type="text" name="title" placeholder="Title" required><br>
            <textarea name="description" placeholder="Description"></textarea><br>
            <input type="date" name="deadline" required><br>
            <input type="file" name="file" accept="application/pdf"><br>
            <input type="url" name="link" placeholder="https://..."><br>
            <button type="submit">Create</button>
            <button type="button" class="btn btn-xs btn-secondary" id="cancelCreateAssignmentBtn">Back</button>
        </form>
        <div id="assignmentCreationStatus"></div>
    `;
    document.getElementById('createAssignmentForm').onsubmit = async e => {
        e.preventDefault();
        const form = e.target;
        const statusDiv = document.getElementById('assignmentCreationStatus');
        const submitBtn = form.querySelector('button[type="submit"]');
        
        try {
            // Show loading state
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating...';
            statusDiv.innerHTML = '<div style="color: blue; margin-top: 10px;">Creating assignment...</div>';
            
            const formData = new FormData(form);
            const response = await fetch(`http://localhost:4000/api/courses/${courseId}/assignments`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + state.token },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Failed to create assignment: ${response.status}`);
            }
            
            // Show success message
            statusDiv.innerHTML = '<div style="color: green; margin-top: 10px;">Assignment created successfully!</div>';
            
            // Wait a moment then restore the panel
            setTimeout(() => {
                restoreManagePanel(courseId);
            }, 1000);
            
        } catch (error) {
            console.error('Error creating assignment:', error);
            statusDiv.innerHTML = `<div style="color: red; margin-top: 10px;">Error: ${error.message}</div>`;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create';
        }
    };
    document.getElementById('cancelCreateAssignmentBtn').onclick = () => restoreManagePanel(courseId);
};

window.showCreateQuiz = function(courseId) {
    // State for quiz creation
    let quizQuestions = [];
    let editingIndex = null;

    function renderQuizForm() {
        let html = `
            <h5>Create Quiz</h5>
            <div style="margin-bottom: 1em; font-weight: bold;">Questions: ${quizQuestions.length} / 50</div>
            <form id="createQuizForm">
                <input type="text" name="title" placeholder="Quiz Title" required><br>
                <div id="quizQuestionsList">
        `;
        if (quizQuestions.length === 0) {
            html += `<div class="empty-msg">No questions added yet.</div>`;
        } else {
            quizQuestions.forEach((q, idx) => {
                if (editingIndex === idx) {
                    // Expanded edit mode
                    html += renderQuestionEditor(q, idx);
                } else {
                    html += `<div class="quiz-question-summary compact-panel">
                        <b>Q${idx + 1}:</b> ${q.text} [${q.type.toUpperCase()}]
                        <button type="button" class="btn btn-xs btn-primary" onclick="editQuizQuestion(${idx})">Edit</button>
                        <button type="button" class="btn btn-xs btn-danger" onclick="removeQuizQuestion(${idx})">Remove</button>
                    </div>`;
                }
            });
        }
        html += `</div>
                <button type="button" id="addQuestionBtn" class="btn btn-success add-btn"${quizQuestions.length >= 50 ? ' disabled' : ''}>+ Add Question</button><br><br>
                <button type="submit">Create Quiz</button>
                <button type="button" class="btn btn-xs btn-secondary" id="cancelCreateQuizBtn">Back</button>
            </form>
        `;
        document.getElementById(`manageCourseDetail_${courseId}`).innerHTML = html;
        document.getElementById('addQuestionBtn').onclick = () => {
            if (quizQuestions.length >= 50) {
                alert('Maximum 50 questions allowed per quiz.');
                return;
            }
            editingIndex = quizQuestions.length;
            quizQuestions.push({ text: '', type: 'mcq', options: ['', '', '', ''], answer: '' });
            renderQuizForm();
            // Scroll to the new question
            setTimeout(() => {
                const el = document.getElementById(`q${editingIndex}_text`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        };
        document.getElementById('createQuizForm').onsubmit = async e => {
            e.preventDefault();
            if (editingIndex !== null) {
                alert('Please save or cancel the question you are editing before submitting the quiz.');
                return;
            }
            if (quizQuestions.length === 0) {
                alert('Please add at least one question to the quiz.');
                return;
            }
            if (quizQuestions.length > 50) {
                alert('Maximum 50 questions allowed per quiz.');
                return;
            }
            // Validate all questions
            for (let i = 0; i < quizQuestions.length; i++) {
                const q = quizQuestions[i];
                if (!q.text || !q.type) {
                    alert(`Question ${i+1} is incomplete. Please fill all required fields.`);
                    return;
                }
                if (q.type === 'mcq') {
                    if (!q.options || q.options.length < 2 || !q.options[0] || !q.options[1]) {
                        alert(`Question ${i+1} (MCQ) must have at least 2 options.`);
                        return;
                    }
                    if (!q.answer || isNaN(q.answer) || q.answer < 1 || q.answer > 4) {
                        alert(`Question ${i+1} (MCQ) must have a valid correct option (1-4).`);
                        return;
                    }
                } else if (q.type === 'numerical') {
                    if (!q.answer) {
                        alert(`Question ${i+1} (Numerical) must have a correct answer.`);
                        return;
                    }
                }
            }
            const form = e.target;
            const title = form.title.value;
            // Create quiz
            const quizRes = await fetch(`http://localhost:4000/api/courses/${courseId}/quizzes`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + state.token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ title })
            });
            const quiz = await quizRes.json();
            // Add all questions
            for (let q of quizQuestions) {
                await fetch(`http://localhost:4000/api/quizzes/${quiz.id}/questions`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + state.token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        question_text: q.text,
                        question_type: q.type,
                        options: q.type === 'mcq' ? q.options : [],
                        answer: q.answer
                    })
                });
            }
            restoreManagePanel(courseId);
        };
        document.getElementById('cancelCreateQuizBtn').onclick = () => restoreManagePanel(courseId);
    }

    window.editQuizQuestion = function(idx) {
        editingIndex = idx;
        renderQuizForm();
    };
    window.removeQuizQuestion = function(idx) {
        quizQuestions.splice(idx, 1);
        if (editingIndex === idx) editingIndex = null;
        renderQuizForm();
    };
    window.saveQuizQuestion = function(idx) {
        // Get values from the editor
        const qText = document.getElementById(`q${idx}_text`).value;
        const qType = document.getElementById(`q${idx}_type`).value;
        let options = [];
        let answer = '';
        if (qType === 'mcq') {
            options = [
                document.getElementById(`q${idx}_opt1`).value,
                document.getElementById(`q${idx}_opt2`).value,
                document.getElementById(`q${idx}_opt3`).value,
                document.getElementById(`q${idx}_opt4`).value
            ];
            answer = document.getElementById(`q${idx}_correct`).value;
        } else if (qType === 'numerical') {
            answer = document.getElementById(`q${idx}_numans`).value;
        }
        quizQuestions[idx] = { text: qText, type: qType, options, answer };
        editingIndex = null;
        renderQuizForm();
    };
    window.cancelEditQuizQuestion = function(idx) {
        // If new, remove; if existing, just close
        if (!quizQuestions[idx].text) quizQuestions.splice(idx, 1);
        editingIndex = null;
        renderQuizForm();
    };

    function renderQuestionEditor(q, idx) {
        let html = `<div class="quiz-question-editor compact-panel">
            <label>Question ${idx + 1}: <input type="text" id="q${idx}_text" value="${q.text || ''}" required></label><br>
            <label>Type:
                <select id="q${idx}_type" onchange="updateQuizQuestionType(${idx})">
                    <option value="mcq"${q.type === 'mcq' ? ' selected' : ''}>MCQ</option>
                    <option value="numerical"${q.type === 'numerical' ? ' selected' : ''}>Numerical</option>
                </select>
            </label><br>`;
        if (q.type === 'mcq') {
            html += `<div class="mcq-options">
                <label>Option 1: <input type="text" id="q${idx}_opt1" value="${q.options[0] || ''}" required></label><br>
                <label>Option 2: <input type="text" id="q${idx}_opt2" value="${q.options[1] || ''}" required></label><br>
                <label>Option 3: <input type="text" id="q${idx}_opt3" value="${q.options[2] || ''}"></label><br>
                <label>Option 4: <input type="text" id="q${idx}_opt4" value="${q.options[3] || ''}"></label><br>
                <label>Correct Option (1-4): <input type="number" id="q${idx}_correct" min="1" max="4" value="${q.answer || ''}" required></label><br>
            </div>`;
        } else if (q.type === 'numerical') {
            html += `<div class="numerical-answer">
                <label>Correct Answer: <input type="text" id="q${idx}_numans" value="${q.answer || ''}" required></label><br>
            </div>`;
        }
        html += `<button type="button" class="btn btn-xs btn-success" onclick="saveQuizQuestion(${idx})">Save</button>
            <button type="button" class="btn btn-xs btn-secondary" onclick="cancelEditQuizQuestion(${idx})">Cancel</button>
        </div>`;
        return html;
    }

    window.updateQuizQuestionType = function(idx) {
        // Update type and re-render editor
        const newType = document.getElementById(`q${idx}_type`).value;
        quizQuestions[idx].type = newType;
        if (newType === 'mcq') {
            quizQuestions[idx].options = quizQuestions[idx].options || ['', '', '', ''];
            quizQuestions[idx].answer = '';
        } else if (newType === 'numerical') {
            quizQuestions[idx].options = [];
            quizQuestions[idx].answer = '';
        }
        renderQuizForm();
    };

    renderQuizForm();
};

window.showAddQuestion = function(quizId, courseId) {
    document.getElementById(`manageCourseDetail_${courseId}`).innerHTML += `
        <h5>Add Question</h5>
        <form id="addQuestionForm">
            <input type="text" name="question_text" placeholder="Question" required><br>
            <select name="question_type" required>
                <option value="mcq">MCQ</option>
                <option value="truefalse">True/False</option>
                <option value="short">Short Answer</option>
            </select><br>
            <input type="text" name="options" placeholder="Options (comma separated for MCQ)"><br>
            <input type="text" name="answer" placeholder="Answer"><br>
            <button type="submit">Add</button>
            <button type="button" class="btn btn-xs btn-secondary" id="cancelAddQuestionBtn">Back</button>
        </form>
    `;
    document.getElementById('addQuestionForm').onsubmit = async e => {
        e.preventDefault();
        const form = e.target;
        let options = form.options.value ? form.options.value.split(',').map(s => s.trim()) : [];
        try {
            const response = await fetch(`http://localhost:4000/api/quizzes/${quizId}/questions`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + state.token, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question_text: form.question_text.value,
                    question_type: form.question_type.value,
                    options,
                    answer: form.answer.value
                })
            });
            if (response.status === 401 || response.status === 403) {
                alert('Session expired or unauthorized. Please log in again.');
                return;
            }
            if (!response.ok) {
                throw new Error(`Failed to add question: ${response.status}`);
            }
            restoreManagePanel(courseId);
        } catch (err) {
            alert('Error adding question: ' + err.message);
        }
    };
    document.getElementById('cancelAddQuestionBtn').onclick = () => restoreManagePanel(courseId);
};

window.viewSubmissions = async function(assignmentId, courseId) {
    window._lastAssignmentIdForSubmissions = assignmentId;
    const res = await fetch(`http://localhost:4000/api/assignments/${assignmentId}/submissions`, {
        headers: { 'Authorization': 'Bearer ' + state.token }
    });
    const submissions = await res.json();
    let html = `<h5>Submissions</h5><ul>`;
    if (submissions.length === 0) {
        html += '<li>No submissions yet.</li>';
    } else {
        submissions.forEach(s => {
            html += `<li>${s.student_name}: ${s.file_path ? `<a href='http://localhost:4000${s.file_path}' target='_blank'>Download</a>` : 'No file'} - Grade: ${s.grade || 'Ungraded'}`;
            if (!s.grade) {
                html += ` <button onclick=\"gradeSubmission(${s.id}, ${courseId})\">Grade</button>`;
            }
            html += `</li>`;
        });
    }
    html += `</ul><button class='btn btn-xs btn-secondary' onclick='restoreManagePanel(${courseId})'>Back</button>`;
    document.getElementById(`manageCourseDetail_${courseId}`).innerHTML = html;
};

window.restoreManagePanel = async function(courseId) {
    try {
        document.getElementById(`manageCourseDetail_${courseId}`).innerHTML = '<div style="padding:1em;text-align:center;">Loading...</div>';
        const html = await getManageCourseHtml(courseId);
        document.getElementById(`manageCourseDetail_${courseId}`).innerHTML = html;
    } catch (error) {
        console.error('Error restoring manage panel:', error);
        document.getElementById(`manageCourseDetail_${courseId}`).innerHTML = `
            <div style="padding:1em;text-align:center;color:red;">
                Error loading course management panel. 
                <button onclick="restoreManagePanel(${courseId})" class="btn btn-xs btn-primary">Retry</button>
            </div>
        `;
    }
};

window.gradeSubmission = function(submissionId, courseId) {
    const grade = prompt('Enter grade:');
    if (!grade) return;
    fetch(`http://localhost:4000/api/submissions/${submissionId}/grade`, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + state.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade })
    }).then(() => {
        alert('Graded!');
        // Refresh the submissions list
        if (window._lastAssignmentIdForSubmissions) {
            window.viewSubmissions(window._lastAssignmentIdForSubmissions, courseId);
        }
    });
};

window.viewQuizSubmissions = async function(quizId, courseId) {
    const res = await fetch(`http://localhost:4000/api/quizzes/${quizId}/submissions`, {
        headers: { 'Authorization': 'Bearer ' + state.token }
    });
    const submissions = await res.json();
    let html = `<h5>Quiz Submissions</h5><ul>`;
    submissions.forEach(s => {
        html += `<li>${s.student_name}: Score: ${s.score || 'Ungraded'}</li>`;
    });
    html += `</ul><button class='btn btn-xs btn-secondary' onclick='restoreManagePanel(${courseId})'>Back</button>`;
    document.getElementById(`manageCourseDetail_${courseId}`).innerHTML = html;
};

async function renderAdminPanel() {
    // List all users
    const usersRes = await fetch('http://localhost:4000/api/admin/users', {
        headers: { 'Authorization': 'Bearer ' + state.token }
    });
    const users = await usersRes.json();
    let html = `<h4>All Users</h4><table border="1"><tr><th>Name</th><th>Email</th><th>Role</th><th>Verified</th><th>Actions</th></tr>`;
    users.forEach(u => {
        html += `<tr><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td><td>${u.verified ? 'Yes' : 'No'}</td><td><button onclick="editUser(${u.id})">Edit</button> <button onclick="deleteUser(${u.id})">Delete</button></td></tr>`;
    });
    html += `</table>`;
    document.getElementById('adminUsers').innerHTML = html;

    // List all courses
    const coursesRes = await fetch('http://localhost:4000/api/courses');
    const courses = await coursesRes.json();
    let cHtml = `<h4>All Courses</h4><table border="1"><tr><th>Title</th><th>Instructor</th><th>Actions</th></tr>`;
    courses.forEach(c => {
        cHtml += `<tr><td>${c.title}</td><td>${c.instructor_name || ''}</td><td><button onclick="deleteCourse(${c.id})">Delete</button></td></tr>`;
    });
    cHtml += `</table>`;
    document.getElementById('adminCourses').innerHTML = cHtml;
}

window.editUser = function(userId) {
    // For demo, just allow changing role and verified
    const role = prompt('Enter new role (admin, instructor, student):');
    const verified = prompt('Verified? (1 for yes, 0 for no):');
    fetch(`http://localhost:4000/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + state.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, verified })
    }).then(() => renderAdminPanel());
};

window.deleteUser = function(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    fetch(`http://localhost:4000/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + state.token }
    }).then(() => renderAdminPanel());
};

window.deleteCourse = function(courseId) {
    if (!confirm('Are you sure you want to delete this course?')) return;
    fetch(`http://localhost:4000/api/courses/${courseId}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + state.token }
    }).then(() => renderAdminPanel());
};

// Example: Render courses as cards with images
function renderCourses(courses) {
    let html = '<div class="course-list">';
    courses.forEach(course => {
        // Use a default image if course.image is not set
        const imgSrc = course.image || 'https://via.placeholder.com/120x80?text=Course';
        html += `
            <div class="course-card">
                <img class="course-image" src="${imgSrc}" alt="Course Image">
                <div class="card-body">
                    <h5>${course.title}</h5>
                    <p>${course.description || ''}</p>
                    <button onclick="enrollCourse(${course.id})">Enroll</button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    document.getElementById('courses').innerHTML = html;
}

// Add event listeners for header navigation after DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    const navDashboard = document.getElementById('navDashboard');
    const navProfile = document.getElementById('navProfile');
    const navLogout = document.getElementById('navLogout');
    if (navDashboard) {
        navDashboard.onclick = e => {
            e.preventDefault();
            render();
        };
    }
    if (navProfile) {
        navProfile.onclick = e => {
            e.preventDefault();
            renderProfile();
        };
    }
    if (navLogout) {
        navLogout.onclick = e => {
            e.preventDefault();
            localStorage.removeItem('token');
            setState({ token: null, user: null });
        };
    }
});

function renderProfile() {
    const app = document.getElementById('app');
    if (!state.user) {
        app.innerHTML = '<p>Loading profile...</p>';
        fetchMe();
        return;
    }
    let extraInfoHtml = '';
    if (state.user.role === 'student') {
        extraInfoHtml = '<p><strong>Enrolled Courses:</strong></p><ul id="profileCourses"></ul>';
        // Fetch enrolled courses
        fetch('http://localhost:4000/api/my-courses', {
            headers: { 'Authorization': 'Bearer ' + state.token }
        })
        .then(res => res.json())
        .then(courses => {
            const ul = document.getElementById('profileCourses');
            if (courses.length === 0) {
                ul.innerHTML = '<li>None</li>';
            } else {
                ul.innerHTML = courses.map(c => `<li>${c.title}</li>`).join('');
            }
        });
    } else if (state.user.role === 'instructor') {
        extraInfoHtml = '<p><strong>Courses Teaching:</strong></p><ul id="profileCourses"></ul>';
        // Fetch teaching courses
        fetch('http://localhost:4000/api/my-courses', {
            headers: { 'Authorization': 'Bearer ' + state.token }
        })
        .then(res => res.json())
        .then(courses => {
            const ul = document.getElementById('profileCourses');
            if (courses.length === 0) {
                ul.innerHTML = '<li>None</li>';
            } else {
                ul.innerHTML = courses.map(c => `<li>${c.title}</li>`).join('');
            }
        });
    }
    app.innerHTML = `
        <div class="profile-section">
            <h2>My Profile</h2>
            <div class="profile-info">
                <p><strong>Name:</strong> ${state.user.name}</p>
                <p><strong>Email:</strong> ${state.user.email}</p>
                <p><strong>Role:</strong> ${state.user.role}</p>
                ${extraInfoHtml}
            </div>
            <button onclick="render()">Back to Dashboard</button>
        </div>
    `;
}

window.deleteAssignment = async function(assignmentId, courseId) {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    try {
        const response = await fetch(`http://localhost:4000/api/assignments/${assignmentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to delete assignment: ${response.status}`);
        }
        
        // Refresh the manage panel to show updated list
        restoreManagePanel(courseId);
    } catch (error) {
        console.error('Error deleting assignment:', error);
        alert('Error deleting assignment: ' + error.message);
    }
};

window.deleteQuiz = async function(quizId, courseId) {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    try {
        const response = await fetch(`http://localhost:4000/api/quizzes/${quizId}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to delete quiz: ${response.status}`);
        }
        
        // Refresh the manage panel to show updated list
        restoreManagePanel(courseId);
    } catch (error) {
        console.error('Error deleting quiz:', error);
        alert('Error deleting quiz: ' + error.message);
    }
};

// Initial render
if (window.location.hash === '#register') {
    renderRegister();
} else {
    render();
}

async function fetchNotifications() {
    if (!state.token) return [];
    const res = await fetch('http://localhost:4000/api/notifications', {
        headers: { 'Authorization': 'Bearer ' + state.token }
    });
    notifications = await res.json();
    notificationsLoaded = true;
    renderNotificationDropdown();
}

function renderNotificationDropdown() {
    let dropdown = document.getElementById('notificationDropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'notificationDropdown';
        dropdown.className = 'notification-dropdown';
        document.body.appendChild(dropdown);
    }
    if (!notificationsLoaded || notifications.length === 0) {
        dropdown.innerHTML = '<div class="notification-empty">No notifications</div>';
    } else {
        dropdown.innerHTML = notifications.map(n => `
            <div class="notification-item${n.is_read ? '' : ' unread'}" data-id="${n.id}">
                ${n.message}
                <span class="notification-date">${new Date(n.created_at).toLocaleString()}</span>
            </div>
        `).join('');
    }
    // Position dropdown under bell
    const bell = document.getElementById('notificationBell');
    if (bell) {
        const rect = bell.getBoundingClientRect();
        dropdown.style.position = 'absolute';
        dropdown.style.top = (rect.bottom + window.scrollY + 8) + 'px';
        dropdown.style.left = (rect.left + window.scrollX - 120) + 'px';
        dropdown.style.display = 'block';
    }
    // Add click handler to mark as read
    dropdown.querySelectorAll('.notification-item.unread').forEach(item => {
        item.onclick = async function() {
            const id = this.getAttribute('data-id');
            await fetch(`http://localhost:4000/api/notifications/${id}/read`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + state.token }
            });
            this.classList.remove('unread');
            // Optionally, update notifications array and badge
        };
    });
}

// Hide dropdown on click outside
window.addEventListener('click', function(e) {
    const dropdown = document.getElementById('notificationDropdown');
    const bell = document.getElementById('notificationBell');
    if (dropdown && bell && !dropdown.contains(e.target) && e.target !== bell) {
        dropdown.style.display = 'none';
    }
});

window.addEventListener('DOMContentLoaded', function() {
    const bell = document.getElementById('notificationBell');
    if (bell) {
        bell.onclick = function(e) {
            e.stopPropagation();
            fetchNotifications();
        };
    }
});

window.logout = function() {
    localStorage.removeItem('token');
    setState({ token: null, user: null });
}; 