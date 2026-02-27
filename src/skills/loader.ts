import fs from "fs/promises";
import path from "path";

const SKILLS_DIR = path.resolve(process.cwd(), "skills");

export async function loadSkills(): Promise<string> {
    try {
        // Ensure directory exists
        await fs.mkdir(SKILLS_DIR, { recursive: true });

        const files = await fs.readdir(SKILLS_DIR);
        const mdFiles = files.filter(f => f.endsWith(".md"));

        if (mdFiles.length === 0) {
            return "";
        }

        let skillsContext = "\n--- EXTENDED SKILLS & CAPABILITIES ---\n";

        for (const file of mdFiles) {
            const content = await fs.readFile(path.join(SKILLS_DIR, file), "utf-8");
            skillsContext += `\n### Skill: ${file.replace(".md", "")}\n${content}\n`;
        }

        return skillsContext;
    } catch (err) {
        console.error("[skills] Error loading skills:", err);
        return "";
    }
}
