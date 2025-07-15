# 🚀 Holly Studio Production Supabase Setup

## 📋 **COMPLETE SETUP CHECKLIST**

### **Step 1: Configure Environment Variables**

Create/update your `.env.local` file:

```env
# ===================================
# SUPABASE CONFIGURATION (REQUIRED)
# ===================================
NEXT_PUBLIC_SUPABASE_URL=https://lyolfwnnzkzvlebwgjbx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key_here

# ===================================
# N8N WEBHOOK (ALREADY CONFIGURED)
# ===================================
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://pranaut.app.n8n.cloud/webhook/7a117d41-8c93-4293-a378-34f037b14087
```

### **Step 2: Verify Your Existing Table**

✅ **You already have the `project_states` table!** No need to create anything.

Your existing table structure:
- `project_id` (text) - Primary identifier  
- `state_data` (jsonb) - Rich state from n8n
- `created_at` (timestamptz) - Creation timestamp
- `updated_at` (timestamptz) - Last modification

**Optional: Add indexes for better performance (if not already present):**

```sql
-- Check if indexes exist and create if needed
CREATE INDEX IF NOT EXISTS idx_project_states_project_id 
ON project_states(project_id);

CREATE INDEX IF NOT EXISTS idx_project_states_updated_at 
ON project_states(updated_at DESC);
```

### **Step 3: Configure Row Level Security (Optional but Recommended)**

```sql
-- Enable RLS (optional for production security)
ALTER TABLE holly_projects ENABLE ROW LEVEL SECURITY;

-- Allow public access for MVP (adjust for production)
CREATE POLICY "Allow public access" ON holly_projects
FOR ALL USING (true);
```

### **Step 4: Test the Integration**

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Check console logs for:**
   ```
   🚀 Supabase client initialized for production use
   ```

3. **Send a message and watch for:**
   ```
   🔄 Refreshing project state from Supabase after n8n operation...
   ✅ Successfully refreshed state from Supabase
   ```

### **Step 5: Verify Rich Data Flow**

Expected data flow:
1. User sends message → n8n processes → Updates Supabase
2. Frontend fetches fresh state from Supabase
3. Sidebar displays rich project data (images, checklist, budget)

## 🔧 **EXPECTED SUPABASE DATA STRUCTURE**

Your n8n workflow should save data in this format:

```json
{
  "project_id": "uuid-here",
  "state_data": {
    "phase": "image_review",
    "assets": {
      "script": "Your video script...",
      "core_idea": "Project description...",
      "target_audience": "Target demographics...",
      "image_candidates": [
        {
          "url": "https://supabase.co/storage/.../scene_1.png",
          "scene_index": 1,
          "attempt": 3,
          "feedback": null
        }
      ],
      "product_image_url": "https://...",
      "product_description": "..."
    },
    "checklist": {
      "idea_approved": true,
      "script_approved": true,
      "images_approved": false,
      "narration_generated": false,
      "video_clips_generated": false,
      "assembly_complete": false
    },
    "budget": {
      "spent": 0,
      "total": 15
    }
  }
}
```

## 🎯 **EXPECTED RESULTS**

After completing setup, you should see:

✅ **Sidebar displays:**
- Project overview with core idea & target audience
- Progress tracking (2/6 steps completed = 33%)
- Current step highlighting ("Please review the regenerated set...")
- Assets gallery with scene images
- Budget tracker ($0/$15 spent)

✅ **Console logs:**
```
🔄 Fetching project state for project-id from Supabase...
✅ Got fresh state from Supabase: ["assets", "checklist", "budget", "phase"]
🔄 Merged project state: { assets: 8, phase: "image_review", checklistKeys: 6, historyLength: 10 }
```

## 🚨 **TROUBLESHOOTING**

### **Issue: "Supabase credentials missing"**
**Solution:** Check your `.env.local` file is in the project root with correct values.

### **Issue: "PGRST116" - No rows found**  
**Solution:** This is normal for new projects. The table will be populated by n8n.

### **Issue: "Network error accessing Supabase"**
**Solution:** Check your Supabase URL and key. Verify table exists.

### **Issue: Sidebar still shows empty data**
**Solution:** 
1. Verify n8n is updating the `project_states` table
2. Check browser console for fetch errors  
3. Confirm project_id matches between frontend and n8n
4. Run this SQL to check if data exists: `SELECT * FROM project_states WHERE project_id = 'your-project-id'`

## 🔮 **NEXT STEPS AFTER SETUP**

1. Test a full workflow (idea → script → images)
2. Verify state persistence across browser refreshes
3. Test with multiple concurrent projects
4. Optimize performance for large state objects

---

**⚡ This setup enables the production-ready architecture where n8n updates Supabase and the frontend independently fetches rich state data for a beautiful, responsive UI experience.** 