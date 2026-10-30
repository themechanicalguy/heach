# Attendant leave and replacement (amendment A13, manual first)

- **Status:** Draft for owner review (30 October 2026). Amendment A13 is handled by support through the admin for the MVP; automatic replacement is not built.
- **Applies to:** support admins when an attendant cannot do one or more shifts of a booking.

## Before the booking starts (status Confirmed)

1. Open the booking in the admin **Bookings** section.
2. Use **Reassign** to move it to another approved attendant who lists the same service, serves
   the PIN code and is free for the whole booking. The system refuses a provider who is not
   eligible or is busy (AD-05).
3. If nobody is free, **Cancel** with the reason *provider unavailable*: the patient gets a full
   refund automatically.

## After the booking has started (status In progress)

Reassignment is not available once shifts have begun, and there is no "end early" action.

1. Call the patient and agree what they want: wait for the attendant to return, or stop the
   booking and book another attendant for the remaining days (the patient books it; support
   cannot book for a patient).
2. To stop it, **Cancel** in the bookings console with the reason *provider unavailable*.
   The patient gets back the share for the shifts not worked; shifts checked in or out stay paid
   to the attendant (owner decision FU-39).
3. Record the absence. If the attendant missed a shift without notice, it counts as a provider
   no-show strike (A12).

## Gap to close later

- Shift-by-shift replacement inside one booking, and booking on the patient's behalf (follow-up
  register).
