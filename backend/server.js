const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

app.use(cors());
app.use(bodyParser.json());

const upload = multer({ dest: path.join(__dirname, 'uploads/') });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// SQLite DB setup
const db = new sqlite3.Database('./lms.db', (err) => {
    if (err) return console.error('DB connection error:', err.message);
    console.log('Connected to SQLite database.');
});

// Helper: Generate JWT
function generateToken(user) {
    return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
}

// JWT Auth Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

// Role-based Middleware
function authorizeRoles(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
}

app.get('/', (req, res) => {
    res.send('LMS Backend Running');
});

// Register
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'All fields required' });
    const hash = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (name, email, password, role, verified) VALUES (?, ?, ?, ?, 1)', [name, email, hash, role], function(err) {
        if (err) return res.status(400).json({ error: 'Email already exists' });
        db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, user) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            const token = generateToken(user);
            res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
        });
    });
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Invalid credentials' });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ error: 'Invalid credentials' });
        const token = generateToken(user);
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    });
});

// Get current user info
app.get('/api/auth/me', authenticateToken, (req, res) => {
    db.get('SELECT id, name, email, role FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    });
});

// Admin: List all users
app.get('/api/admin/users', authenticateToken, authorizeRoles('admin'), (req, res) => {
    db.all('SELECT id, name, email, role, verified FROM users', [], (err, users) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(users);
    });
});

// Admin: Update user
app.put('/api/admin/users/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
    const { name, email, role, verified } = req.body;
    db.run('UPDATE users SET name=?, email=?, role=?, verified=? WHERE id=?', [name, email, role, verified, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json({ success: true });
    });
});

// Admin: Delete user
app.delete('/api/admin/users/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
    db.run('DELETE FROM users WHERE id=?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json({ success: true });
    });
});

// =====================
// COURSE MANAGEMENT
// =====================

// Create a course (Instructor, Admin)
app.post('/api/courses', authenticateToken, authorizeRoles('instructor', 'admin'), (req, res) => {
    const { title, description } = req.body;
    db.run('INSERT INTO courses (title, description, instructor_id) VALUES (?, ?, ?)', [title, description, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: 'DB error' });
        db.get('SELECT * FROM courses WHERE id = ?', [this.lastID], (err, course) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json(course);
        });
    });
});

// Get all courses (public)
app.get('/api/courses', (req, res) => {
    db.all('SELECT c.*, u.name as instructor_name FROM courses c LEFT JOIN users u ON c.instructor_id = u.id', [], (err, courses) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(courses);
    });
});

// Get a single course (public)
app.get('/api/courses/:id', (req, res) => {
    db.get('SELECT c.*, u.name as instructor_name FROM courses c LEFT JOIN users u ON c.instructor_id = u.id WHERE c.id = ?', [req.params.id], (err, course) => {
        if (err || !course) return res.status(404).json({ error: 'Course not found' });
        res.json(course);
    });
});

// Update a course (Instructor, Admin)
app.put('/api/courses/:id', authenticateToken, authorizeRoles('instructor', 'admin'), (req, res) => {
    const { title, description } = req.body;
    // Only allow instructor who owns the course or admin
    db.get('SELECT * FROM courses WHERE id = ?', [req.params.id], (err, course) => {
        if (err || !course) return res.status(404).json({ error: 'Course not found' });
        if (req.user.role !== 'admin' && course.instructor_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        db.run('UPDATE courses SET title=?, description=? WHERE id=?', [title, description, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json({ success: true });
        });
    });
});

// Delete a course (Instructor, Admin)
app.delete('/api/courses/:id', authenticateToken, authorizeRoles('instructor', 'admin'), (req, res) => {
    db.get('SELECT * FROM courses WHERE id = ?', [req.params.id], (err, course) => {
        if (err || !course) return res.status(404).json({ error: 'Course not found' });
        if (req.user.role !== 'admin' && course.instructor_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        db.run('DELETE FROM courses WHERE id=?', [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json({ success: true });
        });
    });
});

// Enroll in a course (Student)
app.post('/api/courses/:id/enroll', authenticateToken, authorizeRoles('student'), (req, res) => {
    db.run('INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)', [req.user.id, req.params.id], function(err) {
        if (err) return res.status(400).json({ error: 'Already enrolled or DB error' });
        res.json({ success: true });
    });
});

// Unenroll from a course (Student)
app.delete('/api/courses/:id/unenroll', authenticateToken, authorizeRoles('student'), (req, res) => {
    db.run('DELETE FROM enrollments WHERE user_id=? AND course_id=?', [req.user.id, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json({ success: true });
    });
});

// Get courses for current user (Instructor/Student)
app.get('/api/my-courses', authenticateToken, (req, res) => {
    if (req.user.role === 'instructor') {
        db.all('SELECT * FROM courses WHERE instructor_id = ?', [req.user.id], (err, courses) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json(courses);
        });
    } else if (req.user.role === 'student') {
        db.all(`SELECT c.*, u.name as instructor_name
                FROM courses c
                JOIN enrollments e ON c.id = e.course_id
                LEFT JOIN users u ON c.instructor_id = u.id
                WHERE e.user_id = ?`,
            [req.user.id],
            (err, courses) => {
                if (err) return res.status(500).json({ error: 'DB error' });
                res.json(courses);
            }
        );
    } else {
        res.status(403).json({ error: 'Forbidden' });
    }
});

// =====================
// ASSIGNMENTS MODULE
// =====================

// Create assignment (Instructor, Admin)
app.post('/api/courses/:courseId/assignments', authenticateToken, authorizeRoles('instructor', 'admin'), upload.single('file'), (req, res) => {
    console.log('POST /api/courses/:courseId/assignments called');
    console.log('Request body:', req.body);
    console.log('Uploaded file:', req.file);
    const { title, description, deadline, link } = req.body;
    const file_path = req.file ? '/uploads/' + req.file.filename : null;
    db.run('INSERT INTO assignments (course_id, title, description, deadline, file_path, link) VALUES (?, ?, ?, ?, ?, ?)', [req.params.courseId, title, description, deadline, file_path, link], function(err) {
        if (err) {
            console.error('Error inserting assignment:', err);
            return res.status(500).json({ error: 'DB error', details: err.message });
        }
        // Trigger notification for all enrolled students
        db.all('SELECT user_id FROM enrollments WHERE course_id = ?', [req.params.courseId], (err, students) => {
            if (!err && students && students.length > 0) {
                const now = new Date().toISOString();
                students.forEach(s => {
                    db.run('INSERT INTO notifications (user_id, message, is_read, created_at) VALUES (?, ?, 0, ?)', [s.user_id, `New assignment "${title}" added to your course.`, now]);
                });
            }
        });
        db.get('SELECT * FROM assignments WHERE id = ?', [this.lastID], (err, assignment) => {
            if (err) {
                console.error('Error fetching new assignment:', err);
                return res.status(500).json({ error: 'DB error', details: err.message });
            }
            res.json(assignment);
        });
    });
});

// Get assignments for a course (enrolled students, instructor, admin)
app.get('/api/courses/:courseId/assignments', authenticateToken, (req, res) => {
    db.all('SELECT * FROM assignments WHERE course_id = ?', [req.params.courseId], (err, assignments) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(assignments);
    });
});

// Submit assignment (Student)
app.post('/api/assignments/:assignmentId/submit', authenticateToken, authorizeRoles('student'), upload.single('file'), (req, res) => {
    const file_path = req.file ? '/uploads/' + req.file.filename : null;
    const assignmentId = req.params.assignmentId;
    const studentId = req.user.id;
    const now = new Date().toISOString();
    db.get('SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?', [assignmentId, studentId], (err, row) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        if (row) {
            // Update existing submission
            db.run('UPDATE submissions SET file_path = ?, submitted_at = ? WHERE id = ?', [file_path, now, row.id], function(err) {
                if (err) return res.status(500).json({ error: 'DB error on update' });
                res.json({ success: true, updated: true });
            });
        } else {
            // Insert new submission
            db.run('INSERT INTO submissions (assignment_id, student_id, file_path, submitted_at) VALUES (?, ?, ?, ?)', [assignmentId, studentId, file_path, now], function(err) {
                if (err) return res.status(500).json({ error: 'DB error on insert' });
                res.json({ success: true, created: true });
            });
        }
    });
});

// Get submissions for an assignment (Instructor, Admin)
app.get('/api/assignments/:assignmentId/submissions', authenticateToken, authorizeRoles('instructor', 'admin'), (req, res) => {
    db.all('SELECT s.*, u.name as student_name FROM submissions s JOIN users u ON s.student_id = u.id WHERE s.assignment_id = ?', [req.params.assignmentId], (err, submissions) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(submissions);
    });
});

// Grade a submission (Instructor, Admin)
app.put('/api/submissions/:submissionId/grade', authenticateToken, authorizeRoles('instructor', 'admin'), (req, res) => {
    const { grade } = req.body;
    db.run('UPDATE submissions SET grade=? WHERE id=?', [grade, req.params.submissionId], function(err) {
        if (err) return res.status(500).json({ error: 'DB error' });
        // Trigger notification for the student
        db.get('SELECT student_id, assignment_id FROM submissions WHERE id = ?', [req.params.submissionId], (err, sub) => {
            if (!err && sub) {
                db.get('SELECT title, course_id FROM assignments WHERE id = ?', [sub.assignment_id], (err, assignment) => {
                    if (!err && assignment) {
                        const now = new Date().toISOString();
                        db.run('INSERT INTO notifications (user_id, message, is_read, created_at) VALUES (?, ?, 0, ?)', [sub.student_id, `Your assignment "${assignment.title}" has been graded: ${grade}.`, now]);
                    }
                });
            }
        });
        res.json({ success: true });
    });
});

// Grade a quiz submission (Instructor, Admin)
app.put('/api/quiz-submissions/:submissionId/grade', authenticateToken, authorizeRoles('instructor', 'admin'), (req, res) => {
    const { score } = req.body;
    db.run('UPDATE quiz_submissions SET score=? WHERE id=?', [score, req.params.submissionId], function(err) {
        if (err) return res.status(500).json({ error: 'DB error' });
        // Trigger notification for the student
        db.get('SELECT student_id, quiz_id FROM quiz_submissions WHERE id = ?', [req.params.submissionId], (err, sub) => {
            if (!err && sub) {
                db.get('SELECT title FROM quizzes WHERE id = ?', [sub.quiz_id], (err, quiz) => {
                    if (!err && quiz) {
                        const now = new Date().toISOString();
                        db.run('INSERT INTO notifications (user_id, message, is_read, created_at) VALUES (?, ?, 0, ?)', [sub.student_id, `Your quiz "${quiz.title}" has been graded: ${score}.`, now]);
                    }
                });
            }
        });
        res.json({ success: true });
    });
});

// Get student's submissions (Student)
app.get('/api/my-submissions', authenticateToken, authorizeRoles('student'), (req, res) => {
    db.all('SELECT s.*, a.title as assignment_title FROM submissions s JOIN assignments a ON s.assignment_id = a.id WHERE s.student_id = ?', [req.user.id], (err, submissions) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(submissions);
    });
});

// =====================
// QUIZZES MODULE
// =====================

// Create quiz (Instructor, Admin)
app.post('/api/courses/:courseId/quizzes', authenticateToken, authorizeRoles('instructor', 'admin'), (req, res) => {
    const { title } = req.body;
    db.run('INSERT INTO quizzes (course_id, title) VALUES (?, ?)', [req.params.courseId, title], function(err) {
        if (err) return res.status(500).json({ error: 'DB error' });
        db.get('SELECT * FROM quizzes WHERE id = ?', [this.lastID], (err, quiz) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json(quiz);
        });
    });
});

// Add question to quiz (Instructor, Admin)
app.post('/api/quizzes/:quizId/questions', authenticateToken, authorizeRoles('instructor', 'admin'), (req, res) => {
    const { question_text, question_type, options, answer } = req.body;
    db.run('INSERT INTO questions (quiz_id, question_text, question_type, options, answer) VALUES (?, ?, ?, ?, ?)', [req.params.quizId, question_text, question_type, JSON.stringify(options), answer], function(err) {
        if (err) return res.status(500).json({ error: 'DB error' });
        db.get('SELECT * FROM questions WHERE id = ?', [this.lastID], (err, question) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json(question);
        });
    });
});

// Get quizzes for a course
app.get('/api/courses/:courseId/quizzes', authenticateToken, (req, res) => {
    db.all('SELECT * FROM quizzes WHERE course_id = ?', [req.params.courseId], (err, quizzes) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(quizzes);
    });
});

// Get questions for a quiz
app.get('/api/quizzes/:quizId/questions', authenticateToken, (req, res) => {
    db.all('SELECT * FROM questions WHERE quiz_id = ?', [req.params.quizId], (err, questions) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        questions.forEach(q => { if (q.options) q.options = JSON.parse(q.options); });
        res.json(questions);
    });
});

// Submit quiz (Student)
app.post('/api/quizzes/:quizId/submit', authenticateToken, authorizeRoles('student'), (req, res) => {
    const { answers, score } = req.body; // answers: {questionId: answer, ...}
    db.run('INSERT INTO quiz_submissions (quiz_id, student_id, answers, score) VALUES (?, ?, ?, ?)', [req.params.quizId, req.user.id, JSON.stringify(answers), score], function(err) {
        if (err) return res.status(500).json({ error: 'DB error or already submitted' });
        res.json({ success: true });
    });
});

// Get quiz submissions (Instructor, Admin)
app.get('/api/quizzes/:quizId/submissions', authenticateToken, authorizeRoles('instructor', 'admin'), (req, res) => {
    db.all('SELECT qs.*, u.name as student_name FROM quiz_submissions qs JOIN users u ON qs.student_id = u.id WHERE qs.quiz_id = ?', [req.params.quizId], (err, submissions) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(submissions);
    });
});

// Get student's quiz submissions (Student)
app.get('/api/my-quiz-submissions', authenticateToken, authorizeRoles('student'), (req, res) => {
    db.all('SELECT qs.*, q.title as quiz_title FROM quiz_submissions qs JOIN quizzes q ON qs.quiz_id = q.id WHERE qs.student_id = ?', [req.user.id], (err, submissions) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(submissions);
    });
});

// Get student's rank for a quiz (Student)
app.get('/api/quizzes/:quizId/my-rank', authenticateToken, authorizeRoles('student'), (req, res) => {
    const quizId = req.params.quizId;
    const studentId = req.user.id;
    db.all('SELECT student_id, score FROM quiz_submissions WHERE quiz_id = ? ORDER BY score DESC, submitted_at ASC', [quizId], (err, submissions) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        const total = submissions.length;
        const rank = submissions.findIndex(sub => sub.student_id === studentId) + 1;
        const myScore = submissions.find(sub => sub.student_id === studentId)?.score;
        if (rank === 0) {
            return res.status(404).json({ error: 'No submission found for this student.' });
        }
        res.json({ rank, total, score: myScore });
    });
});

// =====================
// PROGRESS TRACKING & ANALYTICS
// =====================

// Get course progress for a student
app.get('/api/courses/:courseId/progress', authenticateToken, authorizeRoles('student'), (req, res) => {
    // Completion: assignments + quizzes submitted / total
    db.serialize(() => {
        db.get('SELECT COUNT(*) as total_assignments FROM assignments WHERE course_id = ?', [req.params.courseId], (err, arow) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            db.get('SELECT COUNT(*) as submitted_assignments FROM submissions s JOIN assignments a ON s.assignment_id = a.id WHERE a.course_id = ? AND s.student_id = ?', [req.params.courseId, req.user.id], (err, asub) => {
                if (err) return res.status(500).json({ error: 'DB error' });
                db.get('SELECT COUNT(*) as total_quizzes FROM quizzes WHERE course_id = ?', [req.params.courseId], (err, qrow) => {
                    if (err) return res.status(500).json({ error: 'DB error' });
                    db.get('SELECT COUNT(*) as submitted_quizzes FROM quiz_submissions qs JOIN quizzes q ON qs.quiz_id = q.id WHERE q.course_id = ? AND qs.student_id = ?', [req.params.courseId, req.user.id], (err, qsub) => {
                        if (err) return res.status(500).json({ error: 'DB error' });
                        const total = arow.total_assignments + qrow.total_quizzes;
                        const completed = asub.submitted_assignments + qsub.submitted_quizzes;
                        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
                        res.json({ percent, completed, total });
                    });
                });
            });
        });
    });
});

// Get grades overview for a student
app.get('/api/grades-overview', authenticateToken, authorizeRoles('student'), (req, res) => {
    db.all('SELECT a.title as assignment, s.grade FROM submissions s JOIN assignments a ON s.assignment_id = a.id WHERE s.student_id = ?', [req.user.id], (err, assignments) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        db.all('SELECT q.title as quiz, qs.score FROM quiz_submissions qs JOIN quizzes q ON qs.quiz_id = q.id WHERE qs.student_id = ?', [req.user.id], (err, quizzes) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json({ assignments, quizzes });
        });
    });
});

// Get time spent on content (stub, as time tracking is frontend-driven)
app.post('/api/courses/:courseId/time', authenticateToken, authorizeRoles('student'), (req, res) => {
    // Accepts { timeSpent: number } in minutes, would store in a real table
    res.json({ success: true });
});

// Leaderboard (by quiz score, optional gamification)
app.get('/api/courses/:courseId/leaderboard', authenticateToken, (req, res) => {
    db.all('SELECT u.name, SUM(qs.score) as total_score FROM quiz_submissions qs JOIN users u ON qs.student_id = u.id JOIN quizzes q ON qs.quiz_id = q.id WHERE q.course_id = ? GROUP BY qs.student_id ORDER BY total_score DESC LIMIT 10', [req.params.courseId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(rows);
    });
});

// Badges (stub, could be expanded)
app.get('/api/my-badges', authenticateToken, (req, res) => {
    // Example: badge for 100% completion
    res.json([{ name: 'Course Finisher', description: 'Completed a course!' }]);
});

// Get grades for a student in a course
app.get('/api/courses/:courseId/grades', authenticateToken, authorizeRoles('student'), (req, res) => {
    const userId = req.user.id;
    const courseId = req.params.courseId;
    // Get assignment grades
    db.all(`SELECT a.title, s.grade FROM submissions s JOIN assignments a ON s.assignment_id = a.id WHERE s.student_id = ? AND a.course_id = ?`, [userId, courseId], (err, assignments) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        // Get quiz grades
        db.all(`SELECT q.title, qs.score as grade FROM quiz_submissions qs JOIN quizzes q ON qs.quiz_id = q.id WHERE qs.student_id = ? AND q.course_id = ?`, [userId, courseId], (err, quizzes) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            // Merge and return
            const grades = [...assignments, ...quizzes];
            res.json(grades);
        });
    });
});

// Delete an assignment (Instructor, Admin)
app.delete('/api/assignments/:assignmentId', authenticateToken, authorizeRoles('instructor', 'admin'), (req, res) => {
    // Only allow if instructor owns the assignment's course or admin
    db.get('SELECT a.*, c.instructor_id FROM assignments a JOIN courses c ON a.course_id = c.id WHERE a.id = ?', [req.params.assignmentId], (err, assignment) => {
        if (err || !assignment) return res.status(404).json({ error: 'Assignment not found' });
        if (req.user.role !== 'admin' && assignment.instructor_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        db.run('DELETE FROM assignments WHERE id = ?', [req.params.assignmentId], function(err) {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json({ success: true });
        });
    });
});

// Delete a quiz (Instructor, Admin)
app.delete('/api/quizzes/:quizId', authenticateToken, authorizeRoles('instructor', 'admin'), (req, res) => {
    // Only allow if instructor owns the quiz's course or admin
    db.get('SELECT q.*, c.instructor_id FROM quizzes q JOIN courses c ON q.course_id = c.id WHERE q.id = ?', [req.params.quizId], (err, quiz) => {
        if (err || !quiz) return res.status(404).json({ error: 'Quiz not found' });
        if (req.user.role !== 'admin' && quiz.instructor_id !== req.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        db.run('DELETE FROM quizzes WHERE id = ?', [req.params.quizId], function(err) {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json({ success: true });
        });
    });
});

// Get notifications for the logged-in user
app.get('/api/notifications', authenticateToken, (req, res) => {
    db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, notifications) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(notifications);
    });
});

// Mark a notification as read
app.post('/api/notifications/:id/read', authenticateToken, (req, res) => {
    db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 