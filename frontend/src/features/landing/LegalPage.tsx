const content = {
  privacy: {
    title: 'Privacy policy',
    intro: 'This policy explains what StudyHive stores and why. It is a template for the operator of this deployment to review and adapt.',
    sections: [
      ['What we collect', 'Your full name, email address, a securely hashed password, and the bookings you make (room, time, group size, optional group name and purpose). We do not collect phone numbers, addresses or payment details.'],
      ['How it is used', 'Only to run the booking service: signing you in, showing your bookings, preventing double bookings and letting administrators manage rooms and resolve problems.'],
      ['Cookies', 'StudyHive uses a session cookie to keep you signed in and a security cookie that protects forms against cross-site request forgery. There are no advertising or tracking cookies.'],
      ['Who can see your data', 'You can see your own bookings. Administrators of this deployment can see bookings and account details in order to manage rooms. Passwords are never visible to anyone.'],
      ['Retention and deletion', 'Booking history is kept so rooms can be managed fairly. Contact the administrator of this deployment to ask for your account to be removed.'],
    ],
  },
  terms: {
    title: 'Terms of use',
    intro: 'These terms set out how study rooms booked through StudyHive may be used. They are a template for the operator of this deployment to review and adapt.',
    sections: [
      ['Bookings', 'A booking reserves the whole room for your group for the time shown. The student who books is responsible for the group and the room during the session.'],
      ['Fair use', 'Book only the time you need and cancel bookings you no longer need so other groups can use the room. Limits on booking length and the number of upcoming bookings may apply.'],
      ['Cancellations', 'You can cancel from your dashboard before the cancellation deadline shown on each booking. Administrators may cancel bookings for maintenance, events or misuse, and will give a reason.'],
      ['Room care', 'Leave the room as you found it, respect the stated capacity and follow any rules posted in the room.'],
      ['Accounts', 'Keep your password private. Accounts that misuse the service may be suspended by an administrator.'],
    ],
  },
} as const

export default function LegalPage({ kind }: { kind: keyof typeof content }) {
  const page = content[kind]
  return (
    <article className="container-page max-w-3xl pb-24 pt-14">
      <p className="eyebrow">Legal</p>
      <h1 className="display mt-3 text-5xl">{page.title}</h1>
      <p className="mt-5 text-lg leading-relaxed text-muted">{page.intro}</p>
      <div className="mt-10 space-y-8">
        {page.sections.map(([heading, text]) => (
          <section key={heading}>
            <h2 className="display text-2xl">{heading}</h2>
            <p className="mt-2 leading-relaxed text-muted">{text}</p>
          </section>
        ))}
      </div>
    </article>
  )
}
