export const onRequestPost = async (context) => {
	try {
		const formData = await context.request.formData();

		const name = String(formData.get('name') || '').trim();
		const email = String(formData.get('email') || '').trim().toLowerCase();
		const interest = String(formData.get('interest') || '').trim();

		if (!email || !email.includes('@')) {
			return json({ ok: false, error: 'Please enter a valid email.' }, 400);
		}

		const createdAt = new Date().toISOString();

		const payload = {
			name,
			email,
			interest: interest || null,
			createdAt,
			sourceIp: context.request.headers.get('CF-Connecting-IP'),
			userAgent: context.request.headers.get('User-Agent'),
		};

		// Ensure table exists (no-op if already created)
		await context.env.DB.prepare(
			`CREATE TABLE IF NOT EXISTS signups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT NOT NULL,
        interest TEXT,
        created_at TEXT NOT NULL,
        source_ip TEXT,
        user_agent TEXT
      )`
		).run();

		// Insert signup
		await context.env.DB.prepare(
			`INSERT INTO signups (name, email, interest, created_at, source_ip, user_agent)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
		)
			.bind(
				payload.name || null,
				payload.email,
				payload.interest,
				payload.createdAt,
				payload.sourceIp || null,
				payload.userAgent || null
			)
			.run();

		return json({
			ok: true,
			message: "You're on the list — we’ll email you the next session details.",
		});
	} catch (error) {
		console.error('Signup error', error);
		return json({
			ok: false,
			error:
				"Something went wrong saving your signup. Please try again in a moment, or email us directly.",
		}, 500);
	}
};

function json(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
		},
	});
}

