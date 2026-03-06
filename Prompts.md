# Onsite Monday – React Native MVP (Phased Build)
#
# Run each phase sequentially in Claude Code.
# Wait for each phase to complete and compile before moving to the next.
# 
# SETUP: Run this first in your terminal before starting:
#
#   npx create-expo-app@latest onsite-monday --template blank-typescript
#   cd onsite-monday
#   npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar expo-haptics expo-image-picker @expo/vector-icons react-native-gesture-handler react-native-reanimated
#
# Then open Claude Code in the onsite-monday directory and paste each phase.
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ╔═══════════════════════════════════════════════════════════════╗
# ║  PHASE 1: Foundation — Context, Data, Navigation, Constants  ║
# ╚═══════════════════════════════════════════════════════════════╝
# Copy everything below this line until the next PHASE marker:

Set up the foundation for a React Native Expo Router app called "Onsite Monday" — a UK trades marketplace connecting tradespeople with job posters. This is a functional MVP demo for investors. All data is in-memory via React Context. No backend, no APIs, no real auth.

## Brand Colours (create constants/colors.ts)
- primary: #8B2020 (deep maroon)
- primaryDark: #6B1818
- primaryLight: #A83232
- accent: #D4A843 (gold)
- background: #FFF8F6
- white: #FFFFFF
- text: #2D2D2D
- textLight: #666666
- border: #E8E8E8
- success: #2E7D32
- error: #C62828

## TypeScript Types (create constants/types.ts)
Define interfaces for: User, Job, Tradesperson, Conversation, Message, Notification, Review. Jobs should have fields for: id, title, trade, location, postcode, duration, days (M/T/W/Th/F), hours, dayRate, description, postedBy (name + business), paymentTerms, interestedCount, interestedUserIds, status ('open'|'accepted'|'in_progress'|'completed'), image placeholder colour.

## Trades Constants (create constants/trades.ts)
- Trade options: Builder, Plumber, Electrician, Joiner, Labourer, Bricklayer, Plasterer, Roofer, Painter & Decorator, Tiler, Scaffolder
- Skills per trade (e.g. Builder: Groundworks, Extensions, Renovations, New Builds, Demolition, Landscaping)
- Accreditation options: CSCS Card, Public Liability Insurance, Employers Liability, City & Guilds, NVQ Level 2, NVQ Level 3, Gas Safe, NICEIC, Part P, JIB Card, PASMA, IPAF, First Aid, Asbestos Awareness

## Seed Data (create data/seedData.ts)
Generate all of the following with realistic UK construction industry data:

**8 tradespeople profiles** — use names: Harry Webb (Labourer, HW Builds, York, £150/d, 4.8★), Joe Bloggs (Joiner, York, £180/d, 4.3★), Jim Blocks (Bricklayer, York, £250/d, 4.9★), Sarah Collins (Electrician, Collins Electrical, Leeds, £220/d, 4.6★), Mike Turner (Plasterer, Leeds, £160/d, 4.1★), Aisha Patel (Plumber, AP Plumbing, Sheffield, £200/d, 4.7★), Tom Bradley (Roofer, Bradley Roofing, Harrogate, £190/d, 4.5★), Ryan O'Connor (Painter & Decorator, Wakefield, £130/d, 3.9★). Each should have 2-3 realistic skills, 1-3 accreditations, location with travel radius, and 1-2 text reviews with reviewer names.

**10 job listings** — mix of: "Garage Extension" (3 days, York, £150/d, Labourer), "Kitchen Refit" (5 days, Leeds, £180/d, Joiner), "Bathroom Renovation" (4 days, Sheffield, £200/d, Plumber), "Loft Conversion Support" (10 days, York, £160/d, Labourer), "Garden Wall Build" (2 days, Harrogate, £220/d, Bricklayer), "Office Refurb" (7 days, Leeds, £170/d, Joiner), "Roofing Repair" (3 days, Wakefield, £190/d, Roofer), "New Build Groundworks" (8 days, York, £150/d, Labourer), "Rewiring Job" (4 days, Leeds, £230/d, Electrician), "Full House Plaster" (5 days, Sheffield, £160/d, Plasterer). Each needs realistic descriptions (2-3 sentences), posted by names with businesses, working hours, postcodes, and future start dates.

**4 conversations** with 4-6 messages each — realistic chats about job availability, start times, tools needed, confirming details. Mix of sent/received. Include timestamps from recent days.

**6 notifications** — mix of: job application received, job accepted, payment of £450 received, new 5-star review from Dave C, profile viewed 3 times today, new job matching your skills posted. Mix of read/unread.

**Current user:** Dave Mitchell, DM Construction, Builder, York, £200/d, 4.7★ rating, 23 reviews, Silver subscription. Has 2 accepted jobs and 1 posted job from the seed data.

## App Context (create context/AppContext.tsx)
Create a React Context provider that holds all the seed data above plus:
- isAuthenticated (boolean, default false)
- currentUser
- tradespeople array
- jobs array
- myJobs: { accepted: Job[], posted: Job[] }
- conversations array
- notifications array

Provide mutation functions:
- toggleJobInterest(jobId)
- createJob(job)
- updateProfile(updates)
- sendMessage(conversationId, text)
- markJobComplete(jobId)
- submitReview(jobId, rating, text)
- updateSubscription(tier)
- markNotificationRead(id)
- setAuthenticated(bool)

## Navigation (set up app/ directory for Expo Router)
Configure the root layout with AppContext provider wrapping everything.
Set up:
- app/_layout.tsx — root layout with context provider
- app/index.tsx — redirect to welcome if not authenticated, tabs if authenticated
- app/(auth)/ group — welcome, sign-up, sign-in screens (placeholder for now, just basic screens with navigation)
- app/(tabs)/_layout.tsx — bottom tab navigator with 5 tabs: Jobs (briefcase), My Jobs (clipboard), People (people), Messages (chat), Profile (person). Use maroon active colour, grey inactive.
- app/(tabs)/jobs.tsx — placeholder "Jobs Board" text
- app/(tabs)/my-jobs.tsx — placeholder
- app/(tabs)/people.tsx — placeholder
- app/(tabs)/messages.tsx — placeholder
- app/(tabs)/profile.tsx — placeholder

## Reusable Components (create these as stubs)
- components/Header.tsx — custom header with maroon background, white text, search + menu icons, optional bell icon with notification badge
- components/Toast.tsx — simple toast notification that slides in from top
- components/StarRating.tsx — displays 1-5 stars (filled/unfilled), optional interactive mode for input
- components/ChipSelector.tsx — grid of selectable chips, supports single or multi select, maroon styling
- components/EmptyState.tsx — centred icon + title + subtitle for empty lists

Make sure everything compiles with `npx expo start`. The app should launch, show authentication check, redirect to a basic welcome screen, and the tab navigation should be accessible (you can temporarily set isAuthenticated to true to test tabs).


# ╔═══════════════════════════════════════════════════════════════╗
# ║  PHASE 2: Auth Screens — Welcome, Sign Up, Sign In           ║
# ╚═══════════════════════════════════════════════════════════════╝
# Copy everything below this line:

Build the authentication screens for Onsite Monday. The app context, seed data, navigation structure, and brand constants are already set up from the previous phase. Do not modify existing context or data files.

## Welcome Screen (app/(auth)/welcome.tsx or app/index.tsx)
- Full screen maroon (#8B2020) gradient background
- "Ônsite Monday" in large white bold text, centred
- "Your trusted trades network" tagline in gold (#D4A843) below
- Subtitle: "Finding skilled tradespeople, on-demand." in white
- Below: a large area for an illustration — create a simple composition using vector icons (hard hat, wrench, hammer arranged nicely) as a placeholder
- "Find great Tradespeople to work on your next job with." in white, smaller
- "Let's get started today!" with a gold arrow icon — tapping navigates to Sign Up
- At bottom: "Already have an account? Sign in" — "Sign in" is a gold tappable link
- StatusBar light content

## Sign Up Screen (app/(auth)/sign-up.tsx)
Implement as a horizontal FlatList/ScrollView pager with dot indicators at the bottom. 8 slides total. Include a "Back" arrow on slides 2+ and show progress (e.g., "Step 2 of 8").

**Slide 1 — Create Account:**
- White/off-white background
- "Create an account" header in maroon
- "Already have an account? Sign in" link
- Inputs: Full Name, Email, Password (with show/hide toggle)
- "Sign up" button (maroon, full width, rounded)
- Construction illustration placeholder at bottom (use vector icons)

**Slide 2 — Your Trade:**
- "What's your trade?" header
- Grid of trade options as tappable cards (icon + label), 2 columns
- Single select — selected card gets maroon background with white text
- "Next" button at bottom

**Slide 3 — Your Skills:**
- "What are your skills?" header
- Show skills relevant to the trade selected in slide 2 (use the trades.ts mapping)
- Multi-select chips — tapped chips get maroon fill
- "Next" button

**Slide 4 — Accreditations:**
- "Your accreditations" header
- Multi-select chips from the accreditations list
- "Skip for now" link below the chips
- "Next" button

**Slide 5 — Day Rate:**
- "Set your day rate" header
- Large £ figure display that updates as slider moves
- Slider from £50 to £500 (step £10)
- Toggle switch: "Show on profile" vs "Available upon request"
- Helper text: "Most [selected trade] in Yorkshire charge between £120–£220/day"
- "Next" button

**Slide 6 — Location:**
- "Where are you based?" header
- Text input for city/town
- "How far will you travel?" label
- Slider: 5 to 50 miles, showing value as "X miles"
- "Next" button

**Slide 7 — Profile Photo:**
- "Add a profile photo" header
- Large circular placeholder (120px) with camera icon
- Two buttons: "Take Photo" and "Choose from Library" (use expo-image-picker, or just show a simulated selection)
- "Skip for now" link
- "Next" button

**Slide 8 — All Set:**
- "You're all set! 🎉" header
- Brief summary: "Welcome, [Name]! Your [Trade] profile is ready."
- Checkmark icon or celebration illustration
- "Go to Jobs Board" primary button (maroon)
- Tapping sets isAuthenticated = true in context with all the data from the slides populating currentUser, then navigates to the main tabs

All slides should smoothly animate between each other. Store the onboarding form data in local component state, only committing to context on the final slide.

## Sign In Screen (app/(auth)/sign-in.tsx)
- Top section: maroon background with "Hi, Welcome Back!" in white, bold
- "Don't have an account? Sign up" with gold link
- Group illustration placeholder (use arranged vector icons — multiple hard hats/workers)
- Below maroon section: white card area with:
  - "Email" input
  - "Password" input (with show/hide)
  - "Forgot password?" link (just shows an alert "Reset link sent!" for demo)
  - "Sign in" button (maroon, full width)
- On sign in: set isAuthenticated = true in context with the default currentUser from seed data, navigate to tabs

Ensure all auth screens work correctly — sign up completes the full flow, sign in skips to tabs, and the app remembers auth state during the session.


# ╔═══════════════════════════════════════════════════════════════╗
# ║  PHASE 3: Jobs Board & Job Detail                             ║
# ╚═══════════════════════════════════════════════════════════════╝
# Copy everything below this line:

Build the Jobs Board and Job Detail screens for Onsite Monday. Context, seed data, navigation, and auth screens are already built. Do not modify existing files unless necessary for navigation.

## Reusable JobCard Component (components/JobCard.tsx)
A card used in both Jobs Board and My Jobs. Props: job object, onPress, onToggleInterest.
- White card, rounded corners (12px), subtle shadow, 1px border #E8E8E8
- Left side: coloured circle (use the job's placeholder colour) with trade icon
- Content:
  - Trade badge: "🔨 Labourer" style, with location "📍 York, UK"
  - Duration bold: "3 Days" followed by day letters (M/T/W highlighted in maroon if active, grey if not)
  - Day rate: "£150/d" in maroon bold
- Right side: thumbs up icon (outline if not interested, filled gold if interested)
  - Show interest count below thumb
  - Tapping toggles interest via context function
- Whole card tappable to navigate to detail

## Jobs Board (app/(tabs)/jobs.tsx)
- Custom header: maroon background, "Jobs" title in white, search icon (left) and menu icon (right), bell icon with notification badge count
- Below header: "Sort by" dropdown/picker aligned right — options: Nearest, Newest, Highest Pay, Shortest Duration. Sorting should actually reorder the list.
- FlatList of JobCard components from context jobs array (only show status='open' jobs)
- Pull-to-refresh: show a spinner for 1 second then resolve
- If no jobs: show EmptyState component ("No jobs available right now. Check back soon!")
- Search icon in header: tapping shows a search bar that filters jobs by title, trade, or location

## Job Detail Screen (app/job/[id].tsx)
- Get the job by ID from context
- Header: back arrow, title area, search + menu icons
- Top section:
  - Job image placeholder (coloured rectangle with trade icon, rounded corners)
  - Job title large and bold (e.g., "Garage Extension")
  - Thumbs up button (top right, tappable)
- Info section with icon + label pairs:
  - 📅 "3 Days // 8am – 3pm"
  - 📆 "Mon 1st June 2026 – Wed 3rd June 2026"
  - 📍 "26 Leeside, YO24 2PR, York"
- Details section (label: value pairs):
  - Role: "Labourer"
  - Posted by: "Dave C // DC Joinery" — tappable, navigates to that person's profile if they exist in tradespeople array
  - Pay: "£150/d"
- Brief section:
  - Section header "Brief"
  - Job description paragraph
- Payment Terms section:
  - "Paid within 7 days of job completion, confirmed by both parties."
- "Got a question?" section:
  - Yellow/gold chat icon with "Message the job poster now."
  - Tapping creates/opens a conversation with the poster
- Sticky bottom button: "I'm Interested" (maroon, full width, rounded)
  - If already interested: show "Interest Sent ✓" in gold, disabled
  - Tapping shows a modal: "You've shown interest in this job! The poster will be notified." with "OK" button
  - Adds job to context interest, updates interested count

Make sure tapping between the jobs board and job details works smoothly with proper back navigation.


# ╔═══════════════════════════════════════════════════════════════╗
# ║  PHASE 4: My Jobs & Create Job                               ║
# ╚═══════════════════════════════════════════════════════════════╝
# Copy everything below this line:

Build the My Jobs tab and Create Job screen for Onsite Monday. All previous screens, components, context, and navigation are already set up.

## My Jobs (app/(tabs)/my-jobs.tsx)
- Custom header: maroon background, "My Jobs" title, search + menu icons, bell with badge
- Segmented control below header: "Accepted" | "Posted" — tappable tabs, active tab has maroon underline

**Accepted section:**
- FlatList of job cards from context myJobs.accepted
- Each card is similar to JobCard but with a status badge:
  - "Upcoming" — gold badge (top right of card)
  - "In Progress" — green badge
  - "Completed" — grey badge
- Cards are tappable → navigate to Job Detail
- For "In Progress" jobs: show a "Mark Complete" button on the card (green outline button)
  - Tapping shows confirmation modal: "Mark this job as complete?"
  - Confirming navigates to the Review screen: app/review/[jobId].tsx
- If empty: "No accepted jobs yet. Browse the Jobs Board to find work!" with link to Jobs tab
- "Find more jobs here" link at bottom → navigates to Jobs tab

**Posted section:**
- FlatList of job cards from context myJobs.posted
- Each card shows: job title, trade needed, dates, and "X interested" count
- Cards tappable → navigate to Job Detail
- Floating Action Button (FAB) in bottom right: gold (#D4A843) circle, 56px, white "+" icon, shadow
  - Tapping navigates to Create Job screen
- If empty: "You haven't posted any jobs yet" with "Post your first job" button

## Create Job Screen (app/create-job.tsx)
- Header: "Post a Job" with back arrow
- ScrollView form with the following fields, each with a label and appropriate input:

1. **Job Title** — text input, placeholder "e.g., Garage Extension"
2. **Trade Required** — picker/dropdown with trade options from constants
3. **Location** — text input, placeholder "e.g., 26 Leeside, York"
4. **Postcode** — text input, placeholder "e.g., YO24 2PR"
5. **Start Date** — date display that opens a date picker on tap
6. **Duration** — number input with "days" suffix
7. **Working Days** — row of day buttons (M, T, W, Th, F, S, Su), multi-select, selected = maroon fill
8. **Working Hours** — two time inputs: "Start" and "End" (e.g., "08:00" and "16:00")
9. **Day Rate** — number input with £ prefix
10. **Job Description** — multiline text area, 4 lines, placeholder "Describe the work, requirements, and any tools needed..."
11. **Payment Terms** — picker showing options based on subscription tier:
    - Bronze: "30 days after completion"
    - Silver: "14 days after completion"
    - Gold: "7 days after completion"
12. **Photos** (optional) — "Add Photos" button, shows up to 4 image placeholders in a grid

- Form validation: title, trade, location, duration, day rate, and description are required. Show inline red error text for empty required fields on submit attempt.
- "Post Job" button at bottom (maroon, full width)
- On submit:
  - Create a new job object with a generated ID
  - Add it to context jobs array (so it appears on the board)
  - Add it to context myJobs.posted
  - Show a success toast: "Job posted successfully!"
  - Navigate back to My Jobs (Posted tab)

## Review Screen (app/review/[jobId].tsx)
- Header: "Rate your experience" with back arrow
- Job summary card at top: title, dates, other party's name
- Large star rating input: 5 stars in a row, tappable, stars fill left-to-right in gold (#D4A843)
- Text area: "Write your review..." — multiline, placeholder text
- Character encouragement: "Please write at least 20 characters" shown below if under 20 chars
- "Submit Review" button (maroon) — disabled until rating selected AND review has 20+ characters
- On submit:
  - Add the review to the relevant tradesperson's profile in context
  - Update job status to 'completed'
  - Show success modal: "Review submitted! Payment of £[total] will be released within [X] days based on your [tier] plan."
  - Navigate back to My Jobs

Make sure the full flow works: My Jobs → Mark Complete → Review → Submit → Back to My Jobs with updated status.


# ╔═══════════════════════════════════════════════════════════════╗
# ║  PHASE 5: People Search & Person Detail                      ║
# ╚═══════════════════════════════════════════════════════════════╝
# Copy everything below this line:

Build the People tab and Person Detail screen for Onsite Monday. All previous phases are complete.

## Reusable PersonCard Component (components/PersonCard.tsx)
- White card, rounded corners, shadow, border
- Layout:
  - Name: large, bold (e.g., "Harry Webb")
  - Profile circle with initials (top right, coloured based on trade)
  - Trade badge + location + star rating: "🔨 Labourer 📍 York, UK ⭐ 4.8"
  - "Skills & Accreditations" label, then chips/tags (max 2 lines, overflow hidden)
  - "Day Rate" label: "£150" or "Available upon request"
  - "Hire" button on the right (outlined maroon, rounded)
- Card tappable → navigate to Person Detail
- "Hire" button: opens a modal "Invite [Name] to a job" with a picker listing the user's posted jobs, then a "Send Invite" button. On confirm, show toast "Invite sent to [Name]!"

## People Tab (app/(tabs)/people.tsx)
- Custom header: maroon background, "People" title, location badge "📍 York, UK"
- Search bar below header: filters tradespeople by name, trade, or skills as you type
- Horizontally scrollable filter chips below search: All, Labourer, Joiner, Plumber, Electrician, Bricklayer, Plasterer, Roofer, Painter. "All" selected by default. Tapping a chip filters the list to that trade. Selected chip = maroon fill, others = outlined.
- FlatList of PersonCard components from context tradespeople array
- If search/filter yields no results: EmptyState "No tradespeople found matching your search"

## Person Detail Screen (app/person/[id].tsx)
- Get person by ID from context tradespeople array
- ScrollView layout:
- **Header section:**
  - Profile circle with initials (large, 80px, top right)
  - Name: large, bold
  - Trade + Business name (if exists) + Star rating: "🔨 Labourer 🏢 HW Builds ⭐ 4.8"
  - Phone: "📞 07933193481" with tappable call icon
  - Location: "📍 York, UK"
- **Skills & Accreditations section:**
  - Chip/tag layout, wrapping, maroon-tinted background
- **Day Rate section:**
  - "£150/d" or "Available upon request"
- **Locations section:**
  - "York + 10 miles"
  - "Leeds + 15 miles" (if multiple)
- **Reviews section:**
  - Section header "Reviews" with average rating display
  - List of ReviewCard components:
    - Star rating (filled stars in gold)
    - Review text in quotes
    - Reviewer: "Dave C // DC Joinery"
    - Divider between reviews
  - If no reviews: "No reviews yet"
- **Gallery section:**
  - Section header "Gallery"
  - Grid of coloured placeholder squares (3 columns), rounded corners
  - If no gallery: "No gallery photos yet"
- **Bottom sticky bar:**
  - Two buttons side by side: "Hire" (maroon fill) and "Message" (outlined maroon)
  - "Hire" triggers the same invite modal as PersonCard
  - "Message" creates/opens a conversation with this person and navigates to chat


# ╔═══════════════════════════════════════════════════════════════╗
# ║  PHASE 6: Messages, Profile, Subscription & Notifications    ║
# ╚═══════════════════════════════════════════════════════════════╝
# Copy everything below this line:

Build the remaining screens for Onsite Monday: Messages, Chat, Profile, Edit Profile, Subscription Tiers, and Notifications. All previous phases are complete. This is the final phase — after this the app should be fully functional for investor demos.

## Messages Tab (app/(tabs)/messages.tsx)
- Custom header: maroon, "Messages" title, bell icon with badge
- FlatList of conversation items from context conversations array, sorted by most recent message
- Each item (components/ConversationItem.tsx):
  - Avatar circle with initials (left, 48px)
  - Name (bold)
  - Last message preview (single line, truncated, grey)
  - Timestamp right-aligned (e.g., "2m ago", "1h ago", "Yesterday")
  - Unread dot (maroon, 10px circle) if conversation has unread messages
- Tapping navigates to app/chat/[id].tsx
- If no conversations: EmptyState "No messages yet. Start a conversation from a job listing or tradesperson profile."

## Chat Detail (app/chat/[id].tsx)
- Header: back arrow, person's name + avatar, online status dot (green, decorative)
- FlatList (inverted) of messages:
  - Sent messages (from currentUser): maroon (#8B2020) bubble, white text, right-aligned, rounded corners (top-left, top-right, bottom-left rounded; bottom-right less rounded)
  - Received messages: light grey (#F0F0F0) bubble, dark text, left-aligned, mirrored rounding
  - Small timestamp below each message (grey, 10px)
  - Date separators between days ("Today", "Yesterday", "Mon 17 Feb")
- Input bar fixed at bottom:
  - Attachment icon (paperclip, grey, decorative)
  - TextInput with placeholder "Type a message...", flex: 1, rounded
  - Send button: maroon circle with white arrow icon
  - Send button disabled (greyed) when input is empty
- **Functional messaging:**
  - Typing text and pressing send adds a new message to the conversation in context
  - Message appears immediately in the chat
  - Auto-scrolls to latest message
  - Update the conversation's lastMessage and timestamp in context so the Messages list reflects it
- KeyboardAvoidingView so the input stays above the keyboard

## Profile Tab (app/(tabs)/profile.tsx)
- Custom header: maroon, search + settings gear icon
- ScrollView showing the current user's profile from context:
- **Top section:**
  - Profile photo circle (80px, right-aligned) with initials or image
  - Name: large, bold (e.g., "Dave Mitchell")
  - Trade + Business + Rating: "🔨 Builder 🏢 DM Construction ⭐ 4.7"
  - Phone: "📞 07891234567"
  - Location: "📍 York, UK"
- **Skills & Accreditations:** chip/tag display
- **Day Rate:** "£200/d"
- **Locations:** "York + 25 miles"
- **Reviews section:** ReviewCards from seed data
- **Gallery section:** placeholder grid
- **Action buttons:**
  - "Edit Profile" button (outlined maroon) → navigates to edit-profile
  - "My Subscription" card showing current tier name + price with "Manage" button → navigates to subscription
- **Footer links:** Help & Support, Terms of Service, Privacy Policy, Log Out
  - Log Out: confirmation alert, then sets isAuthenticated = false, navigates to welcome

## Edit Profile Screen (app/edit-profile.tsx)
- Header: "Edit Profile" with back arrow and "Save" text button (right)
- ScrollView form:
  - Profile photo (tappable circle, camera overlay icon, triggers expo-image-picker or simulates)
  - First Name input
  - Last Name input
  - Business Name input
  - Phone input
  - Trade picker/dropdown
  - Skills: ChipSelector component, multi-select, shows options for selected trade
  - Accreditations: ChipSelector, multi-select
  - Day Rate: number input with £ prefix
  - Day Rate Visibility: toggle "Show on profile" / "Available upon request"
  - Location: text input
  - Travel Radius: slider 5–50 miles with value label
  - Gallery: horizontal scroll of image slots, "+" button to add (simulated with image picker)
- "Save" button at bottom (maroon, full width)
- On save: update currentUser in context, show toast "Profile updated!", navigate back

## Subscription Screen (app/subscription.tsx)
- Header: "Choose your plan" with back arrow
- Three vertically stacked tier cards:

**Bronze — £29/month:**
- Bronze circle icon, "Bronze" title
- "Best for: Sole traders"
- Features list: 30 day payment terms, 1-2 job posts/month, Basic invoices, Basic reporting, Basic support
- Button: "Select" or "Current Plan" (if active, shown in gold outline, disabled)

**Silver — £59/month:**
- Silver circle, "Popular" badge (gold)
- "Best for: Growing teams"
- 14 day payment, up to 5 posts/month, same basic features
- Button: "Select" or "Current Plan"

**Gold — £129/month:**
- Gold circle, "Best Value" badge
- "Best for: Established contractors"
- 7 day payment, Unlimited posts, Discounted insurances, Compliance tracking, Advanced everything
- Button: "Select" or "Current Plan"

- Tapping "Select" on a different tier: shows confirmation modal "Switch to [Tier] — £[X]/month?" with "Confirm" and "Cancel"
- On confirm: update currentUser.subscription in context, show toast "Plan updated to [Tier]!", navigate back

## Notifications Screen (app/notifications.tsx)
- Accessible from the bell icon in any header (use a stack push)
- Show notification badge count (unread count) on the bell icon across all tab headers
- Header: "Notifications" with back arrow
- FlatList of notifications from context, sorted newest first
- Each item:
  - Icon on left (varies: 📋 for job app, ✅ for accepted, 💰 for payment, ⭐ for review, 👁 for profile view)
  - Title (bold) and description (grey)
  - Timestamp right side
  - Unread items: subtle maroon-tinted background (#8B202008) and maroon left border (3px)
  - Read items: plain white background
- Tapping marks as read (remove tint/border) and navigates to relevant screen (or just marks read for demo)
- "Mark all as read" text button in header

## Final Checks
- Ensure ALL navigation works: every screen is reachable and back buttons return correctly
- Ensure state mutations work: posting a job appears on the board, sending a message appears in chat, submitting a review appears on the profile, changing subscription updates the profile
- Ensure the full investor demo flow is smooth: Welcome → Sign In → Browse Jobs → View Detail → Show Interest → View My Jobs → Mark Complete → Review → See payment confirmation
- Ensure the tab bar shows on all main screens, hides on detail/modal screens
- Ensure no TypeScript errors, no yellow box warnings
- Test that the app runs in Expo Go on a physical device