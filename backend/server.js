const express = require('express');
const http = require('http'); // NEW
const cors = require('cors');
const { Server } = require("socket.io"); // NEW
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { Octokit } = require("@octokit/rest");
const simpleGit = require('simple-git');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const server = http.createServer(app); // Wrap Express app
const io = new Server(server, {
    cors: {
        origin: "*", // allow all origins for now
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const generateEmailHTML = require('./emailTemplate');

const INVITE_STORE_PATH = path.join(__dirname, 'pendingInvites.json');

function loadInvites() {
    try {
        if (fs.existsSync(INVITE_STORE_PATH)) {
            const data = fs.readFileSync(INVITE_STORE_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error("Error reading stored invites", e);
    }
    return {};
}

function saveInvites(invitesObj) {
    try {
        fs.writeFileSync(INVITE_STORE_PATH, JSON.stringify(invitesObj, null, 2));
    } catch (e) {
        console.error("Error saving invites", e);
    }
}

// Our frontend URL for redirects
const FRONTEND_URL = 'http://localhost:8089';
const BACKEND_URL = 'http://localhost:3000';

let transporter = null;

async function setupMailer() {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        transporter = nodemailer.createTransport({
            service: 'gmail', // Defaulting to Gmail formatting
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        console.log(`Real SMTP Mailer configured for: ${process.env.SMTP_USER}`);
    } else {
        // Create a testing account on Ethereal
        let testAccount = await nodemailer.createTestAccount();

        transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
        console.log("No SMTP details found in .env. Falled back to Ethereal Mailer.");
    }
}
setupMailer();

app.post('/api/invite', async (req, res) => {
    try {
        const { inviteeName, inviteeEmail, role, inviterName, inviterEmail } = req.body;

        if (!inviteeEmail || !inviteeName || !inviterName) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Generate secure token
        const token = crypto.randomBytes(32).toString('hex');

        // Store it
        const invites = loadInvites();
        invites[token] = {
            inviteeName, inviteeEmail, role, inviterName, inviterEmail, status: 'pending',
            clientUrl: req.body.clientUrl || FRONTEND_URL
        };
        saveInvites(invites);

        // Create the accept/reject URLs
        const acceptUrl = `${BACKEND_URL}/api/respond?token=${token}&action=accept`;
        const rejectUrl = `${BACKEND_URL}/api/respond?token=${token}&action=reject`;

        // Generate beautiful HTML HTML
        const htmlBody = generateEmailHTML(inviteeName, inviterName, role, acceptUrl, rejectUrl);

        // Send email
        let info = await transporter.sendMail({
            from: `"${inviterName} (via Byteforgenet)" <${process.env.SMTP_USER || "noreply@byteforgenet.com"}>`,
            to: inviteeEmail,
            subject: `Action Required: Invitation to join the Byteforgenet Team`,
            html: htmlBody
        });

        if (process.env.SMTP_USER) {
            console.log("Real Email sent successfully.");
            res.json({
                success: true,
                message: "Invitation sent successfully",
            });
        } else {
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log("Preview URL: ", previewUrl);
            res.json({
                success: true,
                message: "Test Invitation sent successfully",
                previewUrl: previewUrl
            });
        }

    } catch (err) {
        console.error("Invite error:", err);
        res.status(500).json({ error: "Failed to send invite" });
    }
});

// Helper for pending repos
const PENDING_REPOS_FILE = path.join(__dirname, 'pendingRepos.json');
const getPendingRepos = () => {
    if (!fs.existsSync(PENDING_REPOS_FILE)) return {};
    return JSON.parse(fs.readFileSync(PENDING_REPOS_FILE, 'utf8'));
};
const savePendingRepos = (data) => {
    fs.writeFileSync(PENDING_REPOS_FILE, JSON.stringify(data, null, 2));
};

app.post('/api/repo-preview', async (req, res) => {
    const { repoName, description, isPrivate, language, userEmail, userName } = req.body;

    if (!repoName || !userEmail) return res.status(400).json({ error: "Missing required fields" });

    // 1. Generate unique approval token
    const token = crypto.randomBytes(32).toString('hex');

    // 2. Save to pending configurations
    const repos = getPendingRepos();
    repos[token] = { repoName, description, isPrivate, language, userEmail, timestamp: Date.now() };
    savePendingRepos(repos);

    // 3. Create the approval link
    const confirmUrl = `http://localhost:3000/api/repo-confirm?token=${token}`;

    // 4. Send the Email
    try {
        const mailOptions = {
            from: '"Byteforgenet AI" <ai@byteforgenet.com>',
            to: userEmail,
            subject: `Action Required: Approve creation of ${repoName}`,
            html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #131318; color: #fff; padding: 30px; border-radius: 12px; border: 1px solid #333;">
                <h2 style="color: #4f8cff; margin-top: 0;">Approve Repository Creation</h2>
                <p style="color: #ccc;">Hi ${userName || 'User'},</p>
                <p style="color: #ccc;">Your AI Assistant has staged the following repository for creation on GitHub:</p>
                
                <div style="background: #1a1a24; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #2a2a35;">
                    <h3 style="margin: 0 0 10px 0; color: #fff;">${repoName} <span style="font-size: 11px; background: ${isPrivate ? '#f43f5e' : '#22c55e'}; padding: 2px 6px; border-radius: 4px; vertical-align: middle; margin-left: 10px;">${isPrivate ? 'PRIVATE' : 'PUBLIC'}</span></h3>
                    <p style="color: #aaa; margin: 0 0 10px 0; font-size: 14px;">${description || 'No description'}</p>
                    <p style="color: #888; margin: 0; font-size: 13px;">Language: ${language || 'None'}</p>
                </div>
                
                <a href="${confirmUrl}" style="display: inline-block; background: #4f8cff; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin-top: 10px;">Confirm & Create Repository</a>
                
                <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #333; padding-top: 20px;">If you did not request this, you can safely ignore this email.</p>
            </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Approval email sent.', previewUrl: nodemailer.getTestMessageUrl(info) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to send approval email' });
    }
});

app.get('/api/repo-confirm', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send("No token provided");

    const repos = getPendingRepos();
    const config = repos[token];

    if (!config) {
        return res.status(404).send("<h2>Invalid or expired token.</h2>");
    }

    // Check for GitHub Token
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
        return res.status(500).send("<h2>Server Configuration Error</h2><p>GITHUB_TOKEN is missing in the .env file.</p>");
    }

    try {
        const octokit = new Octokit({ auth: GITHUB_TOKEN });

        // 1. Create Remote Repository on GitHub
        const repoRes = await octokit.rest.repos.createForAuthenticatedUser({
            name: config.repoName,
            description: config.description,
            private: config.isPrivate,
            auto_init: false // We will init locally and push
        });

        const cloneUrl = repoRes.data.clone_url;

        // 2. Setup Local Directory
        const baseReposDir = path.join(__dirname, '..', '..', 'generated-repos');
        if (!fs.existsSync(baseReposDir)) fs.mkdirSync(baseReposDir, { recursive: true });

        const localRepoPath = path.join(baseReposDir, config.repoName);
        if (!fs.existsSync(localRepoPath)) fs.mkdirSync(localRepoPath, { recursive: true });

        // 3. Initialize Git, Create README, and Push
        const git = simpleGit(localRepoPath);

        fs.writeFileSync(path.join(localRepoPath, 'README.md'), `# ${config.repoName}\n\n${config.description}\n\n> This repository was automatically generated by Byteforge AI.`);

        // Basic gitignore based on language
        if (config.language && config.language.toLowerCase() === 'node') {
            fs.writeFileSync(path.join(localRepoPath, '.gitignore'), `node_modules/\n.env\n.DS_Store`);
        } else if (config.language && config.language.toLowerCase() === 'python') {
            fs.writeFileSync(path.join(localRepoPath, '.gitignore'), `__pycache__/\n*.pyc\n.env\nvenv/`);
        }

        await git.init();
        await git.add('./*');
        await git.commit('Initial commit by Byteforge AI');
        await git.branch(['-M', 'main']);

        // Add remote with auth embedded in URL for simple-git push
        const userRes = await octokit.rest.users.getAuthenticated();
        const username = userRes.data.login;
        const authRemoteUrl = `https://${username}:${GITHUB_TOKEN}@github.com/${username}/${config.repoName}.git`;

        await git.addRemote('origin', authRemoteUrl);
        await git.push('origin', 'main');

        // 4. Cleanup token
        delete repos[token];
        savePendingRepos(repos);

        res.send(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                <h1 style="color: #22c55e;">Success!</h1>
                <p>Repository <strong>${config.repoName}</strong> has been created and pushed to GitHub.</p>
                <a href="${repoRes.data.html_url}" target="_blank" style="display:inline-block; margin-top: 20px; padding: 10px 20px; background: #4f8cff; color: white; text-decoration: none; border-radius: 6px;">View on GitHub</a>
            </div>
        `);

    } catch (err) {
        console.error("Repo Creation Error:", err);
        res.status(500).send(`<h2>Error creating repository</h2><p>${err.message}</p>`);
    }
});

app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, topic, message, priority, pageUrl } = req.body;

        if (!name || !email || !topic || !message) {
            return res.status(400).json({ error: "Missing required fields: name, email, topic, or message." });
        }

        // Format the email professionaly
        const htmlBody = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
                <h2 style="color: #333; margin-top: 0;">New Contact Form Submission</h2>
                <p style="color: #555; line-height: 1.5;">You received a new message from the Byteforgenet contact form. Details below:</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f5f5f5; width: 100px;"><strong>Name:</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f5f5f5; color: #333;">${name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f5f5f5;"><strong>Email:</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f5f5f5;"><a href="mailto:${email}" style="color: #4f8cff; text-decoration: none;">${email}</a></td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f5f5f5;"><strong>Category:</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f5f5f5; color: #333;">${topic}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f5f5f5;"><strong>Priority:</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f5f5f5; color: #333;">${priority || "N/A"}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f5f5f5;"><strong>Source Page:</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #f5f5f5; color: #4f8cff; font-family: monospace;">${pageUrl || "Unknown"}</td>
                    </tr>
                </table>
                <h3 style="margin-top: 20px; color: #333;">Message:</h3>
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; color: #444; line-height: 1.6; white-space: pre-wrap;">${message}</div>
                <p style="color: #888; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">Automated message from Byteforgenet.</p>
            </div>
        `;

        const ownerEmail = process.env.SMTP_USER || "shreyasgjoshising1@gmail.com";

        // Send email to owner
        let info = await transporter.sendMail({
            from: `"${name}" <${process.env.SMTP_USER || "noreply@byteforgenet.com"}>`,
            to: ownerEmail,
            subject: `Contact Form [${topic}]: ${name}`,
            html: htmlBody,
            replyTo: email
        });

        if (process.env.SMTP_USER) {
            console.log("Contact form email sent successfully.");
            res.json({ success: true, message: "Feedback sent properly" });
        } else {
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log("Contact form test preview URL: ", previewUrl);
            res.json({ success: true, previewUrl: previewUrl });
        }

    } catch (err) {
        console.error("Contact error:", err);
        res.status(500).json({ error: "Failed to process feedback" });
    }
});

// ==========================================
// TASK ASSIGNMENT NOTIFICATION ENDPOINT
// ==========================================
app.post('/api/task-assign', async (req, res) => {
    try {
        let { taskTitle, taskDescription, deadline, assigneeEmail, assignerName } = req.body;

        if (!assigneeEmail || !taskTitle) {
            return res.status(400).json({ error: "Missing required fields: taskTitle or assigneeEmail." });
        }

        // Clean up assigneeEmail in case the frontend sends formats like "Name (email@domain.com)"
        const emailMatch = assigneeEmail.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        if (emailMatch) {
            assigneeEmail = emailMatch[1];
        } else {
            return res.status(400).json({ error: "Invalid assigneeEmail format." });
        }

        const assigner = assignerName || "The Byteforgenet Team";
        const descHtml = taskDescription ? `<p style="color: #666; font-size: 14px; margin-bottom: 20px;"><strong>Description:</strong><br/>${taskDescription}</p>` : "";
        const deadlineHtml = deadline ? `<div style="background: rgba(251, 191, 36, 0.1); border-left: 4px solid #fbbf24; padding: 10px; margin-bottom: 20px;"><strong style="color: #b45309;">Deadline:</strong> <span style="color: #444;">${deadline}</span></div>` : "";

        const acceptUrl = `${FRONTEND_URL}/project.html?action=acceptTask&taskId=${encodeURIComponent(taskTitle)}`;
        const completeUrl = `${FRONTEND_URL}/project.html?action=completeTask&taskId=${encodeURIComponent(taskTitle)}`;

        // Format the email beautifully
        const htmlBody = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                <div style="background: linear-gradient(135deg, #4f8cff 0%, #2563eb 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">New Task Assigned</h1>
                </div>
                <div style="padding: 30px 20px;">
                    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-top: 0;">Hello,</p>
                    <p style="color: #334155; font-size: 16px; line-height: 1.6;">You have been assigned a new task by <strong>${assigner}</strong> on Byteforgenet.</p>
                    
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 25px 0;">
                        <h2 style="color: #1e293b; margin-top: 0; margin-bottom: 15px; font-size: 18px;">${taskTitle}</h2>
                        ${descHtml}
                        ${deadlineHtml}
                    </div>

                    <div style="text-align: center; margin: 35px 0 20px;">
                        <a href="${FRONTEND_URL}/project.html" style="background: #f1f5f9; color: #475569; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block; margin: 4px;">View Board</a>
                        <a href="${acceptUrl}" style="background: #eab308; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block; margin: 4px;">Accept Task</a>
                        <a href="${completeUrl}" style="background: #22c55e; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block; margin: 4px;">Complete Task</a>
                    </div>
                </div>
                <div style="background: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <h3 style="margin: 0 0 5px; color: #475569; font-size: 16px; font-weight: 600;">Byteforgenet</h3>
                    <p style="margin: 0; color: #94a3b8; font-size: 13px;">Advanced Developer Collaboration Platform</p>
                </div>
            </div>
        `;

        let info = await transporter.sendMail({
            from: `"${assigner} (via Byteforgenet)" <${process.env.SMTP_USER || "noreply@byteforgenet.com"}>`,
            to: assigneeEmail,
            subject: `New Task Assignment: ${taskTitle}`,
            html: htmlBody
        });

        if (process.env.SMTP_USER) {
            console.log(`Task assignment email sent successfully to ${assigneeEmail}.`);
            res.json({ success: true, message: "Notification sent" });
        } else {
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log(`Task assignment test preview URL for ${assigneeEmail}: `, previewUrl);
            res.json({ success: true, previewUrl: previewUrl });
        }

    } catch (err) {
        console.error("Task assignment notification error:", err);
        res.status(500).json({ error: "Failed to send notification" });
    }
});

// ==========================================
// BYTEFORGE AI CHATBOT ENDPOINT
// ==========================================
app.post('/api/chat', async (req, res) => {
    try {
        const { message, teamMembers, history } = req.body;
        if (!message) {
            return res.status(400).json({ error: "Message is required." });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(503).json({ error: "Byteforge AI is currently offline. Please configure GEMINI_API_KEY in the backend." });
        }

        // Define tools
        const tools = [
            {
                functionDeclarations: [
                    {
                        name: "create_tasks",
                        description: "Creates one or more new tasks on the user's project board. Use this to break down complex goals into actionable Kanban cards.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                tasks: {
                                    type: "ARRAY",
                                    description: "A list of tasks to create.",
                                    items: {
                                        type: "OBJECT",
                                        properties: {
                                            title: {
                                                type: "STRING",
                                                description: "The title or description of the task."
                                            },
                                            description: {
                                                type: "STRING",
                                                description: "A detailed description of the task."
                                            },
                                            priority: {
                                                type: "STRING",
                                                description: "The priority of the task. Must be one of 'Low', 'Med', 'High'. Default is 'Med'."
                                            },
                                            column: {
                                                type: "STRING",
                                                description: "The project column or status. Must be one of 'todo', 'inprog', 'done'. Default is 'todo'."
                                            },
                                            assignee: {
                                                type: "STRING",
                                                description: "The name of the person assigned to the task."
                                            },
                                            assigneeEmail: {
                                                type: "STRING",
                                                description: "The email address of the person assigned to the task."
                                            }
                                        },
                                        required: ["title", "description"]
                                    }
                                }
                            },
                            required: ["tasks"]
                        }
                    },
                    {
                        name: "breakdown_project",
                        description: "Analyzes a large, vague goal set by the user and automatically breaks it down into 3-5 specific, granular, actionable sub-tasks.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                mainGoal: {
                                    type: "STRING",
                                    description: "The overarching goal the user asked for."
                                },
                                subtasks: {
                                    type: "ARRAY",
                                    description: "The broken-down subtasks.",
                                    items: {
                                        type: "OBJECT",
                                        properties: {
                                            title: { type: "STRING" },
                                            description: { type: "STRING" },
                                            priority: { type: "STRING", description: "Low, Med, High" },
                                            estimatedHours: { type: "NUMBER", description: "Estimated time to complete" }
                                        },
                                        required: ["title", "description", "priority"]
                                    }
                                }
                            },
                            required: ["mainGoal", "subtasks"]
                        }
                    },
                    {
                        name: "prepare_github_repo",
                        description: "Initiates the workflow to create a live GitHub repository. Before calling this, you MUST ask the user for: Name, Description, Visibility (Public/Private), and Language (e.g., Python, Node).",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                repoName: { type: "STRING", description: "The name of the repository (no spaces)" },
                                description: { type: "STRING" },
                                isPrivate: { type: "BOOLEAN" },
                                language: { type: "STRING", description: "Main programming language for gitignore" }
                            },
                            required: ["repoName", "description", "isPrivate", "language"]
                        }
                    }
                ]
            }
        ];

        // Initialize Gemini model
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", tools });

        // System prompt context
        let verifiedUsersContext = "No verified team members provided.";
        if (teamMembers && Array.isArray(teamMembers) && teamMembers.length > 0) {
            verifiedUsersContext = "Verified Team Members:\n" + teamMembers.map(m => `- ${m.name} (${m.email})`).join("\n");
        }

        const systemPrompt = `You are Byteforge AI, the official Agent for Byteforgenet. Your job is to answer user questions politely, accurately, and concisely. Keep your answers brief and readable.
        
IMPORTANT: You have three primary tools at your disposal:
1. create_tasks: Use this if the user explicitly asks to assign specific tasks.
2. breakdown_project: Use this if the user gives a vague, large goal (e.g., "Build login system"). Break it down into 3-5 subtasks.
3. prepare_github_repo: Use this when the user asks to create a GitHub repository.

CRITICAL WORKFLOW FOR GITHUB REPOS (prepare_github_repo):
1. If the user asks to create a repo, you MUST ask them clarifying questions first if they didn't provide all details: Name, Description, Visibility (Public or Private), and main Programming Language.
2. ONLY call prepare_github_repo once you have all 4 pieces of information.

CRITICAL ASSIGNMENT RULES (For create_tasks):
1. If assigning, check if the requested assignee is in the verified list:
${verifiedUsersContext}
2. If the assignee IS NOT in the list, refuse the assignment.
3. If they are in the list, use their exact name and email.`;

        // Initialize Chat Session with accumulated history
        const chatSession = model.startChat({
            history: history || [], // history provided from frontend in {role, parts} format
            systemInstruction: {
                role: "system",
                parts: [{ text: systemPrompt }]
            }
        });

        // Generate response
        const result = await chatSession.sendMessage(message);

        const functionCalls = result.response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            if (call.name === "create_tasks") {
                const args = call.args;
                const taskCount = args.tasks ? args.tasks.length : 0;
                return res.json({
                    reply: `I have successfully generated **${taskCount} task${taskCount !== 1 ? 's' : ''}** on your project board to help you accomplish this!`,
                    action: {
                        type: "CREATE_TASKS",
                        payload: args.tasks // Send the array of tasks
                    }
                });
            } else if (call.name === "breakdown_project") {
                const args = call.args;

                // Smart auto-assignment logic based on team size
                let tasksWithAssignments = args.subtasks.map(task => {
                    let assignedTo = null;
                    let assignedEmail = null;
                    if (teamMembers && teamMembers.length > 0) {
                        // Randomly distribute tasks to team members for now (could be based on workload)
                        const randomMember = teamMembers[Math.floor(Math.random() * teamMembers.length)];
                        assignedTo = randomMember.name;
                        assignedEmail = randomMember.email;
                    }
                    return {
                        ...task,
                        column: 'todo',
                        assignee: assignedTo,
                        assigneeEmail: assignedEmail
                    };
                });

                return res.json({
                    reply: `I have analyzed your goal: **${args.mainGoal}**. I broke this down into **${args.subtasks.length} actionable subtasks** and distributed them across the team board!`,
                    action: {
                        type: "CREATE_TASKS",
                        payload: tasksWithAssignments // Send array of created tasks
                    }
                });
            } else if (call.name === "prepare_github_repo") {
                const args = call.args;
                return res.json({
                    reply: `I have prepared the configuration for **${args.repoName}**! \n\nPlease review the preview card below. Once you click "Send Confirmation Email", an email will be dispatched to your registered address to formally approve the live creation of this repository on your GitHub account.`,
                    action: {
                        type: "PREPARE_REPO",
                        payload: args
                    }
                });
            }
        }

        const responseText = result.response.text();
        res.json({ reply: responseText });

    } catch (err) {
        console.error("AI Chat Error:", err);
        res.status(500).json({ error: "An error occurred while communicating with the AI brain." });
    }
});

// ==========================================
// BYTEFORGE AI NOTE SUMMARIZER ENDPOINT
// ==========================================
app.post('/api/summarize-note', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: "Text is required for summarization." });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(503).json({ error: "Byteforge AI is currently offline. Please configure GEMINI_API_KEY." });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `Please provide a very concise, structured summary of the following note. Use bullet points and bold text where appropriate to highlight key takeaways. Do not include any conversational filler like "Here is the summary:", just return the actual summary content itself directly.\n\nNOTE CONTENT:\n${text}`;

        const result = await model.generateContent(prompt);
        const summary = result.response.text();

        res.json({ summary });

    } catch (err) {
        console.error("AI Summarizer Error:", err);
        res.status(500).json({ error: "An error occurred while synthesizing the note." });
    }
});

app.get('/api/respond', (req, res) => {
    const { token, action } = req.query;
    console.log(`\n--- Received Response --- token: ${token}, action: ${action}`);

    if (!token || !action) {
        console.log("Error: Missing token or action.");
        return res.status(400).send("Invalid request link. Missing token or action.");
    }

    const invites = loadInvites();
    const inviteData = invites[token];

    if (!inviteData) {
        console.log(`Error: Token not found in memory (Link expired/server restarted). Token: ${token}`);
        return res.status(404).send(`
      <div style="font-family:sans-serif; text-align:center; margin-top:50px;">
        <h2>Link Expired or Invalid</h2>
        <p>This invitation has either been processed already, or the development server was restarted (which clears in-memory invites).</p>
        <a href="${FRONTEND_URL}/dashboard.html">Go to Dashboard</a>
      </div>
    `);
    }

    if (action === 'accept') {
        console.log(`Success: Invitation accepted by ${inviteData.inviteeEmail}`);
        inviteData.status = 'accepted';

        // Notify the inviter that they accepted via email
        if (process.env.SMTP_USER) {
            console.log(`Attempting to send acceptance notification to inviter: ${inviteData.inviterEmail}`);
            if (!inviteData.inviterEmail || !inviteData.inviterEmail.includes('@')) {
                console.error("Warning: Invalid inviter email:", inviteData.inviterEmail);
            }
            transporter.sendMail({
                from: `"Byteforgenet" <${process.env.SMTP_USER}>`,
                to: inviteData.inviterEmail,
                subject: `${inviteData.inviteeName} has accepted your invitation!`,
                html: `<div style="font-family: sans-serif; padding: 20px;">
                        <h2>Good news!</h2>
                        <p><strong>${inviteData.inviteeName}</strong> (${inviteData.inviteeEmail}) has accepted your invitation to join the Byteforgenet Team.</p>
                        <p>They have been granted the <strong>${inviteData.role}</strong> role.</p>
                       </div>`
            }).then(() => console.log("Acceptance notification email sent successfully!"))
                .catch(err => console.error("Failed to send acceptance notification:", err));
        }

        // Redirect them to the dashboard / login with a success param
        const redirectBase = inviteData.clientUrl || FRONTEND_URL;
        res.redirect(`${redirectBase}/dashboard.html?invite_accepted=true&team=${encodeURIComponent(inviteData.inviterName)}&role=${encodeURIComponent(inviteData.role)}&accepted_email=${encodeURIComponent(inviteData.inviteeEmail)}`);
    } else if (action === 'reject') {
        console.log(`Success: Invitation rejected by ${inviteData.inviteeEmail}`);
        inviteData.status = 'rejected';

        // Redirect them to the dashboard / login with a reject param
        const redirectBase = inviteData.clientUrl || FRONTEND_URL;
        res.redirect(`${redirectBase}/dashboard.html?invite_rejected=true&rejected_email=${encodeURIComponent(inviteData.inviteeEmail)}`);
    } else {
        console.log(`Error: Invalid action: ${action}`);
        res.status(400).send("Invalid action.");
    }

    // Remove the token after processing
    const invitesToUpdate = loadInvites();
    delete invitesToUpdate[token];
    saveInvites(invitesToUpdate);
    console.log(`Token ${token} deleted from storage.`);
});

// Start checking pending invites endpoint (For frontend to poll if needed, though redirect handles most)
app.get('/api/invites/:email', (req, res) => {
    // Simplistic endpoint to check if an email has any pending invites right now
    const email = req.params.email;
    const invitesArr = [];
    const invitesObj = loadInvites();
    for (let token in invitesObj) {
        const data = invitesObj[token];
        if (data.inviteeEmail === email && data.status === 'pending') {
            invitesArr.push({ token, ...data });
        }
    }
    res.json(invitesArr);
});

// ==========================================
// WEBSOCKET (WHITEBOARD) ENDPOINT
// ==========================================
io.on('connection', (socket) => {
    console.log(`User connected to whiteboard: ${socket.id}`);

    // Join a specific whiteboard room
    socket.on('join-board', (boardId) => {
        socket.join(boardId);
        console.log(`User ${socket.id} joined board ${boardId}`);
    });

    // Handle drawing lines
    socket.on('draw-line', (data) => {
        // Broadcast to everyone ELSE in the room
        socket.to(data.boardId).emit('draw-line', data);
    });

    // Handle generic canvas actions (clear, new shape, etc)
    socket.on('canvas-action', (data) => {
        socket.to(data.boardId).emit('canvas-action', data);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
});
