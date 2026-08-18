/**
 * Structured Portfolio Knowledge Base for Moses AI Assistant
 * Authoritative Source: index.html
 * 
 * IMPORTANT ACCURACY CONSTRAINTS:
 * - Do not invent facts.
 * - Preserve "in progress", "planned", and "completed" statuses.
 * - Forage programs are virtual job simulations, not full-time employment.
 * - Academic projects and design thinking cases are distinct from enterprise deployments.
 */

const portfolioData = {
  identity: {
    name: "Moses Otieno Omondi",
    assistantName: "Moses AI Assistant",
    headline: "Business Intelligence & Data Engineering Professional",
    location: "Nairobi, Kenya",
    availability: "Available for Remote Engagements & Global Consulting Roles",
    tagline: "Building analytics systems that help organizations stop guessing and start deciding with confidence.",
    philosophy: "The most valuable data is that which translates into strategic intelligence. Systems thinking is at the core of Moses's work — understanding the system holistically and the feedback loops within it to make execution deliberate and high-impact."
  },

  contact: {
    email: "mosesomondi.om@gmail.com",
    linkedin: "https://linkedin.com/in/mosesomondi-om",
    github: "https://github.com/mosesomondi",
    resume: "moses_resume_final.pdf"
  },

  education: [
    {
      degree: "Bachelor of Arts in Management (Logistics & Operations)",
      institution: "Southern New Hampshire University (SNHU)",
      accreditation: "US-accredited degree",
      location: "Manchester, NH, USA (completed via Kepler, Kigali, Rwanda)",
      period: "2020 — 2023",
      highlights: [
        "Covered organizational leadership, stakeholder & market analysis, strategic management, HRM, logistics & project management",
        "Parallel coursework in data analytics and Business Intelligence tools",
        "Member of SNHU Student Leadership (Student Engagement Council)"
      ]
    }
  ],

  skills: {
    businessIntelligence: {
      title: "Business Intelligence & Visualization",
      status: "Core Competency",
      tools: ["Power BI", "DAX", "Power Query", "Power BI Service", "Row-Level Security (RLS)", "Advanced Excel / VBA", "Tableau", "Dashboard Design", "KoboToolbox API"],
      description: "End-to-end BI development including data modeling, advanced DAX measures (RANKX, Time Intelligence, dynamic KPI scoring), Power BI Service deployment, RLS, and executive dashboards."
    },
    dataEngineering: {
      title: "Data Engineering & Analytics",
      status: "Core Competency / Active Specialization",
      tools: ["SQL", "MySQL", "RDBMS", "Python (Pandas, BeautifulSoup, scikit-learn)", "ETL Pipelines", "Data Cleaning & Validation"],
      inProgressTools: ["Apache Airflow"],
      plannedTools: ["Microsoft Fabric", "OneLake"],
      description: "Designing SQL schemas, ETL pipelines, data cleaning workflows, and statistical analysis for structured and semi-structured datasets."
    },
    statisticsAndAnalytics: {
      title: "Statistics & Quantitative Analysis",
      status: "Core Competency",
      tools: ["SPSS", "Statistical Analysis", "Hypothesis Testing", "A/B Testing", "Regression Analysis", "Applied Research Design"],
      description: "Descriptive and inferential statistics, regression modeling, and turning datasets into defensible organizational insights."
    },
    appliedAI: {
      title: "Applied AI Specialist",
      status: "Core Competency",
      tools: ["Gemini", "Claude", "NotebookLM", "ChatGPT", "Agentic Workflows", "Prompt Engineering", "Vibe Coding"],
      description: "Orchestrating frontier AI models and agentic tools to design and deploy intelligent analytics systems and automated workflows."
    },
    cloudAndMicrosoft: {
      title: "Cloud & Microsoft Ecosystem",
      status: "Active Specialization",
      tools: ["Power BI Service", "Power Automate", "Azure AI"],
      plannedOrInProgress: ["Microsoft Fabric", "OneLake"],
      description: "Power BI Service administration, dataset scheduling, Azure AI exploration, and Microsoft Fabric architecture."
    }
  },

  certifications: [
    {
      name: "IBM Data Engineering Professional Certificate",
      provider: "IBM / Coursera",
      status: "In Progress"
    },
    {
      name: "PL-300: Microsoft Power BI Data Analyst",
      provider: "Microsoft",
      status: "In Progress"
    },
    {
      name: "DP-700: Microsoft Fabric Data Engineer",
      provider: "Microsoft",
      status: "Planned"
    },
    {
      name: "PwC Switzerland — Power BI Simulation",
      provider: "PwC Switzerland / Forage",
      status: "Completed (Verified Certificate)",
      type: "Virtual Experience Job Simulation"
    },
    {
      name: "Deloitte Australia — Data Analytics & Forensic Technology",
      provider: "Deloitte Australia / Forage",
      status: "Completed (Verified Certificate)",
      type: "Virtual Experience Job Simulation"
    },
    {
      name: "Accenture NA — Data Analytics & Visualisation",
      provider: "Accenture North America / Forage",
      status: "Completed (Verified Certificate)",
      type: "Virtual Experience Job Simulation"
    }
  ],

  workExperience: [
    {
      role: "Power BI Developer & Business Intelligence Consultant",
      organization: "Ashesi University · The Education Collaborative",
      location: "Berekuso, Ghana (Remote)",
      period: "Jul 2025 — Present",
      type: "Consulting Engagement",
      highlights: [
        "Delivered live Institutional Ranking System on Power BI Service integrating KoboToolbox REST API",
        "Engineered multi-featured KoboToolbox survey form with skip logic, calculated fields, dynamic scoring system, and validation constraints",
        "Built advanced DAX measures (RANKX, time intelligence, dynamic KPI scoring)",
        "Collaborated directly with university director, research lead, and senior academic stakeholders"
      ]
    },
    {
      role: "Data & Research Analyst | Secretariat Intern EA Hub",
      organization: "The Education Collaborative",
      location: "Kigali, Rwanda (On-site)",
      period: "Dec 2024 — May 2025",
      type: "Professional Role",
      highlights: [
        "Built Excel RDBMS dashboard consolidating strategic goals progress and performance data, reducing reporting time by ~80%",
        "Performed SPSS outcome analysis leveraging SQL and Python for data cleaning, validation, and loading",
        "Collaborated with regional director and academic staff to compile and publish research work",
        "Managed secretariat operations and leadership travel logistics across network"
      ]
    },
    {
      role: "Teaching Assistant — ITEME Refugee Programme",
      organization: "Kepler College",
      location: "Nyabiheke Refugee Camp, Rwanda (On-site)",
      period: "May 2024 — Oct 2024",
      type: "Professional Role",
      highlights: [
        "Delivered structured course facilitation to ~38 refugee students using the ITEME curriculum",
        "Tracked student performance data and implemented targeted support interventions",
        "Guided ~50 students through multi-institution university application processes"
      ]
    },
    {
      role: "Research Consultant — Spaulding Rehabilitation Network / GEM",
      organization: "Southern New Hampshire University",
      location: "United States (Remote Internship)",
      period: "Jan 2023 — Mar 2023",
      type: "Internship / Consulting Project",
      highlights: [
        "Supported a remote consulting team analyzing a US healthcare-focused research initiative to improve patient access and service delivery",
        "Examined reimbursement structures and stakeholder dynamics for specialized treatment coverage",
        "Translated financial and policy data into analytical input for strategic decision-making"
      ]
    }
  ],

  projects: [
    {
      id: "ashesi",
      name: "Ashesi University Ranking Dashboard",
      category: "Business Intelligence & Consulting",
      filterTag: "bi",
      stack: ["Power BI", "KoboToolbox REST API", "Advanced DAX", "Power Query", "Power BI Service", "RANKX"],
      problem: "Ashesi University and The Education Collaborative needed a standardized, real-time system to benchmark institutional performance across their network without manual spreadsheet exports.",
      solution: "Designed KoboToolbox data collection forms with validation logic and connected them directly to Power BI via REST API for automated live refresh. Implemented RANKX scoring and deployed to Power BI Service.",
      impact: ["100% API automation with zero manual exports", "Live comparative visibility for university directors and academic leadership"]
    },
    {
      id: "tec",
      name: "EA Hub Performance Dashboard",
      category: "Data Analytics & Institutional Research",
      filterTag: "bi",
      stack: ["MySQL", "Advanced Excel", "RDBMS", "SPSS"],
      problem: "The East Africa Hub managed multi-country network goals across disconnected spreadsheets, requiring hours of manual weekly reporting.",
      solution: "Built an Advanced Excel RDBMS dashboard consolidating strategic data sources into an automated reporting model combined with SPSS outcome analysis.",
      impact: ["Reporting preparation time reduced by ~80%", "Contributed data analysis to published research"]
    },
    {
      id: "kepler",
      name: "Learn Research Publication through Design Thinking Digital Portfolio",
      category: "Development & Design Thinking",
      filterTag: "dev",
      stack: ["Design Thinking", "Academic Research", "Portfolio Narrative"],
      problem: "Kepler College students faced meal challenges affecting focus and attendance due to distance and financial constraints.",
      solution: "Proposed a sustainable school canteen service model with a 40% student / 60% school co-funding model presented in a design-thinking digital portfolio.",
      impact: ["Demonstrated human-centered social impact design for institutional challenges"]
    },
    {
      id: "chatporter",
      name: "ChatPorter — In-Memory ChatGPT Conversation Extractor & Privacy Pipeline",
      category: "Development · Privacy Data Pipeline & Tooling",
      filterTag: "dev",
      status: "Live Web App on Render",
      url: "https://chatporter.onrender.com",
      github: "https://github.com/moses-om/chatporter",
      stack: ["JavaScript (ES6+)", "Node.js", "TurboStream Deserialization", "In-Memory Stream Parsing", "Client-Side Privacy Pipeline"],
      problem: "Saving long ChatGPT conversations often fails via shared links due to client-side streaming hydration, while online export tools require uploading private text to unknown servers, risking data leaks of proprietary code and research notes.",
      solution: "Engineered an in-memory streaming decoding engine that extracts and structures ChatGPT conversations directly in volatile RAM, converting shared links into polished Markdown, JSON, and text documents in under 1 second with 100% data privacy.",
      impact: [
        "1-Click export to Markdown (.md), Plain Text (.txt), and JSON (.json) with complete code syntax preservation",
        "Zero-footprint in-memory architecture with zero database persistence and zero third-party telemetry",
        "Sub-second in-memory stream decoding with zero heavy browser overhead"
      ]
    },
    {
      id: "pwc",
      name: "PwC Switzerland — Power BI Simulation",
      category: "Job Simulation",
      filterTag: "sim",
      status: "Completed (Verified Certificate)",
      stack: ["Power BI", "DAX", "Executive Storytelling"],
      description: "Modeled client HR data, constructed Power BI dashboards, and drafted executive summaries for C-suite action."
    },
    {
      id: "deloitte",
      name: "Deloitte Australia — Data Analytics",
      category: "Job Simulation",
      filterTag: "sim",
      status: "Completed (Verified Certificate)",
      stack: ["Tableau", "Excel", "Data Cleaning", "Forensic Analytics"],
      description: "Built Tableau risk visualizations and spreadsheet equality models on client HR datasets."
    },
    {
      id: "accenture",
      name: "Accenture NA — Data Analytics & Visualisation",
      category: "Job Simulation",
      filterTag: "sim",
      status: "Completed (Verified Certificate)",
      stack: ["Excel", "PowerPoint", "Data Cleaning"],
      description: "Cleaned and merged 7 raw datasets to analyze social media content engagement for executive deck presentation."
    },
    {
      id: "ba",
      name: "British Airways — Data Science",
      category: "Job Simulation",
      filterTag: "sim",
      status: "In Progress",
      stack: ["Python", "BeautifulSoup", "NLP", "scikit-learn"],
      description: "Web scraping customer reviews for NLP sentiment analysis and building booking predictive models."
    },
    {
      id: "tata",
      name: "Tata iQ — Data Visualisation",
      category: "Job Simulation",
      filterTag: "sim",
      status: "In Progress",
      stack: ["Power BI", "SQL", "Requirements Framing"],
      description: "Framing executive questions for retail transaction datasets and constructing Power BI storyboards."
    }
  ],

  research: [
    {
      id: "dpoe-paper",
      title: "Evaluating a Multi-Layer Retrieval and Human-Validated Architecture for Cost-Efficient, Grounded Conversational AI",
      year: "2026",
      type: "Upcoming Paper · AI Systems & Architecture",
      status: "Under Compilation",
      summary: "Presents MIRA Intelligence (Decoupled Portfolio Orchestration Engine — DPOE) — a zero-cost, 4-tier conversational AI architecture ($0.00 budget). Production evaluations show a 50% reduction in generative API calls, 15× faster latency (303 ms vs 4,551 ms), and a 98.69% pass rate under security stress testing."
    },
    {
      id: "kepler-paper",
      title: "Relationship Analysis of Professional Competencies & Student Learning Outcomes — Kepler College",
      year: "2025",
      type: "Case Study · Higher Education Research",
      status: "Published on ResearchGate",
      url: "https://www.researchgate.net/publication/400579227_Relationship_Analysis_of_Professional_Competencies_Student_Learning_Outcomes_-A_Case_Study_of_Kepler_College",
      summary: "Quantitative analysis of 587 student records showing a moderate positive correlation between professional competencies (attendance, submission timeliness, task management) and student learning outcomes."
    },
    {
      id: "agl-case",
      title: "Impacts of Intermodal Transportation Optimization on Logistics Performance & Commodity Cost Effectiveness — Africa Global Logistics",
      year: "2023",
      type: "Case Study · Logistics Optimization",
      status: "Published on SSRN",
      url: "https://papers.ssrn.com/abstract=7185141",
      summary: "Evaluated road-sea intermodal transit performance for landlocked Rwanda, demonstrating cost reductions and supply chain transit improvements."
    },
    {
      id: "spaulding-reimbursement",
      title: "Executive Summary of Reimbursement Strategies — Spaulding Rehabilitation Network",
      year: "2023",
      type: "Case Study · Healthcare Strategy",
      status: "Published on SSRN",
      url: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7185338",
      summary: "Analyzed healthcare reimbursement models to improve patient access to specialized rehabilitation care."
    },
    {
      id: "competency-education",
      title: "Secondary Schools Should Adopt Competency-Based Education",
      year: "2020",
      type: "Article · Education Policy",
      status: "Published",
      url: "https://newwritersemerge.wordpress.com/2020/02/12/secondary-schools-should-adopt-competency-based-education-by-moses-otieno-omondi/",
      summary: "Argued for replacing exam-driven traditional secondary education with competency-based skill development."
    },
    {
      id: "mayhem-market",
      title: "Mayhem at the Market",
      year: "2021",
      type: "Article · Political Analysis",
      status: "Published",
      summary: "Political analysis exploring civic accountability, market unrest, and economic forces during moments of crisis."
    }
  ],

  portfolioNavigation: [
    { section: "#about", title: "About Me", description: "Moses's background, management degree, avatar, and career summary." },
    { section: "#skills", title: "Core Competencies", description: "The Toolstack covering BI, Data Engineering, Statistics, AI, and Microsoft Ecosystem." },
    { section: "#projects", title: "Featured Work", description: "Selected projects including Power BI, KoboToolbox API, Excel RDBMS, and job simulations." },
    { section: "#experience", title: "Experience & Education", description: "Career timeline from Ashesi University to Kepler College and SNHU degree." },
    { section: "#research", title: "Research & Writing", description: "Published papers and case studies on ResearchGate, SSRN, and academic journals." },
    { section: "#contact", title: "Get In Touch", description: "Formspree contact form, direct email, LinkedIn, and resume download link." }
  ]
};

module.exports = portfolioData;
