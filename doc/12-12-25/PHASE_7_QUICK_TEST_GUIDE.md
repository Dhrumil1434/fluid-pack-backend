# Phase 7: Quick Testing Guide

## Quick Start Testing Scenarios

### Scenario 1: Create SO and Machine (Happy Path)

1. **Create SO:**

   - Navigate to Admin → SO Management
   - Click "Create SO"
   - Fill in: Name, Category, Party Name, Mobile Number
   - Upload documents (optional)
   - Submit
   - ✅ Verify: SO appears in table

2. **Create Machine with SO:**

   - Navigate to Admin → Machine Management (or Dispatch → Create Machine)
   - Click "Create Machine"
   - Search and select the SO you just created
   - ✅ Verify: SO details displayed (name, category, party, mobile)
   - Fill in: Location
   - Upload images/documents (optional)
   - Submit
   - ✅ Verify: Machine created, shows SO name in table

3. **View Machine:**
   - Click "View" on the machine
   - ✅ Verify: SO Information section shows all SO details
   - ✅ Verify: Machine Information section shows machine-specific fields

---

### Scenario 2: SO Search and Filter

1. **Search SOs:**

   - Go to SO Management
   - Type in search box (try SO name, party name, category)
   - ✅ Verify: Results filtered in real-time

2. **Filter by Category:**

   - Select a category from filter dropdown
   - ✅ Verify: Only SOs with that category shown

3. **Filter by Status:**
   - Toggle Active/Inactive filter
   - ✅ Verify: Only matching SOs shown

---

### Scenario 3: Machine with SO Dropdown

1. **Open Create Machine Modal:**

   - Click "Create Machine"
   - ✅ Verify: SO dropdown appears (not old fields)

2. **Search SO:**

   - Type in SO search box
   - ✅ Verify: Matching SOs appear in dropdown with name, party, category

3. **Select SO:**

   - Click on an SO from dropdown
   - ✅ Verify: SO selected, details card appears below
   - ✅ Verify: Details show: Name, Category, Subcategory, Party, Mobile, Status

4. **Clear Selection:**
   - Click X button
   - ✅ Verify: Selection cleared, form reset

---

### Scenario 4: Deactivate SO and Try to Create Machine

1. **Deactivate SO:**

   - Go to SO Management
   - Find an active SO
   - Click "Deactivate"
   - ✅ Verify: SO status changed to inactive

2. **Try to Create Machine:**
   - Go to Create Machine
   - Try to select the deactivated SO
   - ✅ Verify: Either SO doesn't appear in dropdown (if filtered) OR
   - ✅ Verify: Validation error when trying to submit with inactive SO

---

### Scenario 5: Update SO and Verify Machine Display

1. **Update SO:**

   - Edit an SO (change name or party_name)
   - Save changes

2. **View Machine:**
   - Find a machine using that SO
   - Click "View"
   - ✅ Verify: Machine shows updated SO data

---

### Scenario 6: Sequence Generation

1. **Create Machine with SO:**

   - Create machine with SO that has a category with sequence config
   - Don't fill machine_sequence field

2. **Generate Sequence:**
   - Click "Generate" button next to sequence field
   - ✅ Verify: Sequence generated based on SO's category
   - ✅ Verify: Sequence format matches category's sequence config

---

### Scenario 7: Multiple Machines with Same SO

1. **Create First Machine:**

   - Create machine with SO "Test SO"

2. **Create Second Machine:**

   - Create another machine with same "Test SO"
   - Use different location/dispatch date

3. **Filter by SO:**
   - In machine table, filter by SO name
   - ✅ Verify: Both machines appear

---

## API Testing Quick Commands

### Test SO Endpoints

```bash
# Create SO
curl -X POST http://localhost:3000/api/so \
  -H "Authorization: Bearer <token>" \
  -F "name=Test SO" \
  -F "category_id=<category_id>" \
  -F "party_name=Test Party" \
  -F "mobile_number=+1234567890"

# Get Active SOs
curl -X GET "http://localhost:3000/api/so/active" \
  -H "Authorization: Bearer <token>"

# Get All SOs with Filters
curl -X GET "http://localhost:3000/api/so?category_id=<id>&is_active=true&page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```

### Test Machine Endpoints

```bash
# Create Machine with SO
curl -X POST http://localhost:3000/api/machines \
  -H "Authorization: Bearer <token>" \
  -F "so_id=<so_id>" \
  -F "location=Test Location"

# Get Machines with Populated SO
curl -X GET "http://localhost:3000/api/machines?page=1&limit=10" \
  -H "Authorization: Bearer <token>"

# Filter Machines by SO Category
curl -X GET "http://localhost:3000/api/machines?category_id=<category_id>" \
  -H "Authorization: Bearer <token>"
```

---

## Common Issues to Check

### Issue 1: SO Dropdown Not Showing

- ✅ Check: `loadActiveSOs()` is called when modal opens
- ✅ Check: `SOService.getActiveSOs()` returns data
- ✅ Check: Console for errors

### Issue 2: Machine Table Shows Old Fields

- ✅ Check: Table columns use `m.so?.name` not `m.name`
- ✅ Check: Backend returns populated SO data
- ✅ Check: Machine model has `so` property

### Issue 3: Sequence Not Generating

- ✅ Check: SO has category_id
- ✅ Check: Category has sequence config
- ✅ Check: Console for errors in sequence generation

### Issue 4: Validation Errors Not Showing

- ✅ Check: `handleBackendErrors()` is called
- ✅ Check: `backendErrors` object is populated
- ✅ Check: Template displays `backendErrors[fieldName]`

---

## Verification Checklist

Before marking Phase 7 complete, verify:

- [ ] All SO CRUD operations work
- [ ] All Machine CRUD operations work with SO
- [ ] SO dropdown search and selection works
- [ ] Machine table displays SO data correctly
- [ ] Machine view modal shows SO information
- [ ] Sequence generation works with SO category
- [ ] Filters work correctly (by SO category, party, etc.)
- [ ] No console errors
- [ ] No TypeScript compilation errors
- [ ] UI is consistent across all components
- [ ] All existing machine features still work

---

## Next Steps After Testing

1. **Fix any issues found** during testing
2. **Update documentation** if needed
3. **Run migration** (Phase 6) if not done yet
4. **Deploy to staging** for final validation
5. **Deploy to production** after sign-off
