# Phase 7: Testing and Validation Checklist

## Overview

This document provides a comprehensive testing checklist for Phase 7: Testing and Validation of the SO (Sales Order) Management feature integration.

**Date:** December 2025  
**Status:** In Progress

---

## 1. Backend API Testing

### 1.1 SO Endpoints Testing

#### Create SO

- [ ] **Create SO with all fields**
  - Name, category, subcategory, party_name, mobile_number, description, documents
  - Expected: SO created successfully with all fields
- [ ] **Create SO without optional fields**
  - Only required fields: name, category, party_name, mobile_number
  - Expected: SO created successfully, optional fields defaulted
- [ ] **Create SO with documents**
  - Upload 1-10 documents
  - Expected: Documents uploaded and linked to SO
- [ ] **Create SO with invalid category**
  - Use non-existent category_id
  - Expected: Validation error returned
- [ ] **Create SO with invalid mobile number format**
  - Use invalid mobile number
  - Expected: Validation error returned

#### Get SOs

- [ ] **Get all SOs with pagination**
  - Test page 1, 2, etc.
  - Expected: Correct pagination, total count accurate
- [ ] **Get all SOs with filters**
  - Filter by name, category, party_name, is_active
  - Expected: Only matching SOs returned
- [ ] **Get active SOs only**
  - Call `/so/active` endpoint
  - Expected: Only active SOs returned
- [ ] **Get SO by ID**
  - Use valid SO ID
  - Expected: SO details returned with populated category/subcategory
- [ ] **Get SO by invalid ID**
  - Use non-existent ID
  - Expected: 404 error returned

#### Update SO

- [ ] **Update SO with valid data**
  - Update name, party_name, etc.
  - Expected: SO updated successfully
- [ ] **Update SO with documents**
  - Add/remove documents
  - Expected: Documents updated correctly
- [ ] **Update SO with invalid category**
  - Use non-existent category_id
  - Expected: Validation error returned

#### Delete SO

- [ ] **Delete SO (soft delete)**
  - Delete an SO
  - Expected: SO marked as deleted (deletedAt set), not physically removed
- [ ] **Delete non-existent SO**
  - Use invalid ID
  - Expected: 404 error returned

#### Activate/Deactivate SO

- [ ] **Activate SO**
  - Activate an inactive SO
  - Expected: is_active set to true
- [ ] **Deactivate SO**
  - Deactivate an active SO
  - Expected: is_active set to false

---

### 1.2 Machine Endpoints Testing

#### Create Machine

- [ ] **Create machine with SO reference**
  - Use valid, active SO
  - Expected: Machine created with so_id
- [ ] **Create machine with invalid SO**
  - Use non-existent SO ID
  - Expected: Validation error returned
- [ ] **Create machine with inactive SO**
  - Use inactive SO
  - Expected: Validation error returned (SO must be active)
- [ ] **Create machine with images and documents**
  - Upload images and documents
  - Expected: Files uploaded and linked to machine

#### Get Machines

- [ ] **Get machines with populated SO**
  - Call GET /machines
  - Expected: Machines returned with populated SO data (name, category, party_name, etc.)
- [ ] **Get machines with SO filters**
  - Filter by so_id, category_id (from SO), party_name (from SO)
  - Expected: Correct filtering based on SO data
- [ ] **Get machines with search**
  - Search by SO name, SO party_name, location
  - Expected: Machines matching search criteria returned

#### Update Machine

- [ ] **Update machine with new SO**
  - Change so_id to different valid SO
  - Expected: Machine updated with new SO reference
- [ ] **Update machine with invalid SO**
  - Use non-existent SO ID
  - Expected: Validation error returned
- [ ] **Update machine with inactive SO**
  - Use inactive SO
  - Expected: Validation error returned

#### Sequence Generation

- [ ] **Verify sequence auto-generation**
  - Create machine with SO that has category with sequence config
  - Expected: Machine sequence auto-generated based on SO's category
- [ ] **Verify sequence format**
  - Check generated sequence matches format from sequence config
  - Expected: Sequence follows correct format pattern

---

## 2. Frontend Component Testing

### 2.1 SO Management UI

#### Create SO Form

- [ ] **Form validation**
  - Submit empty form
  - Expected: Validation errors shown for required fields
- [ ] **Mobile number validation**
  - Enter invalid mobile number
  - Expected: Field-level error message displayed
- [ ] **Category selection**
  - Select category, verify subcategories load
  - Expected: Subcategories filtered by selected category
- [ ] **Document upload**
  - Upload 1-10 documents via drag & drop
  - Expected: Documents previewed, can be removed before submit
- [ ] **Document upload limit**
  - Try to upload more than 10 documents
  - Expected: Error message, only first 10 accepted

#### Edit SO Form

- [ ] **Load existing SO data**
  - Open edit modal
  - Expected: All fields pre-filled with current values
- [ ] **Update SO**
  - Change fields and submit
  - Expected: SO updated, table refreshed

#### View SO Details

- [ ] **Display all SO information**
  - Open view modal
  - Expected: All SO fields displayed correctly (name, category, party, mobile, documents, etc.)

#### Delete SO

- [ ] **Delete confirmation**
  - Click delete, confirm
  - Expected: Confirmation modal shown, SO deleted on confirm
- [ ] **Cancel delete**
  - Click delete, cancel
  - Expected: Modal closed, SO not deleted

#### Activate/Deactivate SO

- [ ] **Toggle SO status**
  - Click activate/deactivate button
  - Expected: Status changed, table updated

#### Filter and Search

- [ ] **Search SOs**
  - Enter search term
  - Expected: SOs filtered by name, party_name, category
- [ ] **Filter by category**
  - Select category filter
  - Expected: Only SOs with that category shown
- [ ] **Filter by status**
  - Filter by active/inactive
  - Expected: Only matching SOs shown

#### Pagination

- [ ] **Navigate pages**
  - Click next/previous page
  - Expected: Correct page loaded, pagination controls updated

#### Table Display

- [ ] **All columns visible**
  - Check table columns
  - Expected: Name, Category, Subcategory, Party, Mobile, Status, Documents, Actions visible
- [ ] **Sort columns**
  - Click column headers to sort
  - Expected: Table sorted correctly

---

### 2.2 Machine Management UI

#### Create Machine with SO Selection

- [ ] **SO dropdown search**
  - Type in SO search input
  - Expected: Matching SOs shown in dropdown
- [ ] **SO selection**
  - Select an SO from dropdown
  - Expected: SO selected, details displayed below
- [ ] **SO details display**
  - After selecting SO
  - Expected: Name, Category, Subcategory, Party, Mobile, Status shown
- [ ] **Clear SO selection**
  - Click clear button
  - Expected: SO selection cleared, form reset

#### Machine Table with SO Data

- [ ] **Display SO information**
  - Check table columns
  - Expected: SO Name, SO Category, SO Subcategory, SO Party shown instead of old fields
- [ ] **Handle missing SO data**
  - Machine with unpopulated SO
  - Expected: Shows so_id or "-" gracefully

#### View Machine with SO Info

- [ ] **SO Information section**
  - Open view modal
  - Expected: SO Information section shows all SO fields
- [ ] **Machine Information section**
  - Check machine-specific fields
  - Expected: Location, Dispatch Date, Sequence, Images, Documents shown

#### Edit Machine

- [ ] **Change SO reference**
  - Edit machine, select different SO
  - Expected: Machine updated with new SO
- [ ] **Update other fields**
  - Change location, dispatch date, etc.
  - Expected: Machine updated correctly

#### Sequence Generation

- [ ] **Generate sequence button**
  - Click generate sequence
  - Expected: Sequence generated based on SO's category
- [ ] **Sequence display**
  - After generation
  - Expected: Sequence shown in readonly field

#### All Existing Features

- [ ] **Image upload**
  - Upload images for machine
  - Expected: Images uploaded and displayed
- [ ] **Document upload**
  - Upload documents
  - Expected: Documents uploaded and listed
- [ ] **Metadata management**
  - Add/edit metadata
  - Expected: Metadata saved correctly
- [ ] **Machine approval**
  - Approve/reject machine
  - Expected: Status updated correctly

---

## 3. Integration Testing

### 3.1 End-to-End Workflows

- [ ] **Create SO → Create Machine → View Machine**

  - Create new SO
  - Create machine using that SO
  - View machine details
  - Expected: All steps work, machine shows correct SO data

- [ ] **Deactivate SO → Try to Create Machine**

  - Deactivate an SO
  - Try to create machine with that SO
  - Expected: Validation error or warning shown

- [ ] **Update SO → Verify Machine Display**

  - Update SO's name or party_name
  - View machines using that SO
  - Expected: Machines show updated SO data

- [ ] **Delete SO → Verify Machine Handling**

  - Delete an SO (soft delete)
  - Check machines using that SO
  - Expected: Machines still exist, but SO shows as deleted

- [ ] **Search Machines by SO Name**

  - Search for machine using SO name
  - Expected: Machines with matching SO name returned

- [ ] **Filter Machines by SO Category**

  - Filter machines by category (which filters by SO's category)
  - Expected: Only machines with SOs in that category shown

- [ ] **Multiple Machines with Same SO**
  - Create multiple machines using same SO
  - Expected: All machines linked to same SO, can be filtered together

---

## 4. UI Consistency Check

- [ ] **Modal Styling**

  - Check all modals (Create, Edit, View, Delete)
  - Expected: Consistent styling, same header/footer patterns

- [ ] **Table Styling**

  - Check SO and Machine tables
  - Expected: Consistent column widths, row heights, colors

- [ ] **Button Consistency**

  - Check all buttons
  - Expected: Consistent colors (primary, danger, etc.), sizes, hover states

- [ ] **Form Validation Display**

  - Check error messages
  - Expected: Consistent error styling, placement, messages

- [ ] **Filter Styling**

  - Check filter components
  - Expected: Consistent input styles, dropdown styles

- [ ] **Error Messages**

  - Check toast notifications and inline errors
  - Expected: Consistent styling, positioning, auto-dismiss

- [ ] **Loading States**
  - Check loading indicators
  - Expected: Consistent spinners, disabled states during loading

---

## 5. Performance Testing

- [ ] **Large Dataset Handling**
  - Test with 100+ SOs
  - Expected: Pagination works, search/filter performant
- [ ] **Large Dataset Machines**

  - Test with 100+ machines
  - Expected: Table loads quickly, filters work efficiently

- [ ] **SO Dropdown Performance**
  - Test with many active SOs
  - Expected: Search works quickly, dropdown responsive

---

## 6. Error Handling

- [ ] **Network Errors**
  - Simulate network failure
  - Expected: User-friendly error messages shown
- [ ] **Validation Errors**
  - Submit invalid data
  - Expected: Field-level errors displayed clearly
- [ ] **Server Errors**
  - Simulate 500 errors
  - Expected: Generic error message, no stack traces exposed

---

## 7. Browser Compatibility

- [ ] **Chrome**
  - Test all features
  - Expected: All features work correctly
- [ ] **Firefox**
  - Test all features
  - Expected: All features work correctly
- [ ] **Edge**
  - Test all features
  - Expected: All features work correctly

---

## Testing Notes

### Test Environment

- **Backend:** [URL]
- **Frontend:** [URL]
- **Database:** [Environment]

### Test Data

- Create test SOs with various combinations
- Create test machines with different SOs
- Test edge cases (missing data, invalid data)

### Issues Found

[List any issues found during testing]

---

## Sign-off

- [ ] All backend tests passed
- [ ] All frontend tests passed
- [ ] All integration tests passed
- [ ] UI consistency verified
- [ ] Performance acceptable
- [ ] Ready for production

**Tester:** ********\_********  
**Date:** ********\_********  
**Status:** ********\_********
