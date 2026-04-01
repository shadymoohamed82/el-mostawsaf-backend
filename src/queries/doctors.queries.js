// ─── 1. قائمة الدكاترة ────────────────────────────────────────
const getDoctors = async (client, filters = {}) => {
  const { specialization_id, search = '' } = filters;

  let conditions = [`u.role = 'doctor'`, `u.is_deleted = FALSE`, `u.is_active = TRUE`];
  let params     = [];
  let idx        = 1;

  if (specialization_id) {
    conditions.push(`u.specialization_id = $${idx}`);
    params.push(specialization_id);
    idx++;
  }

  if (search) {
    conditions.push(`u.full_name ILIKE $${idx}`);
    params.push(`%${search}%`);
    idx++;
  }

  const sql = `
    SELECT
      u.id,
      u.full_name,
      u.phone,
      s.name AS specialization,
      s.id   AS specialization_id,
      -- عدد المواعيد المكتملة
      COUNT(a.id) FILTER (WHERE a.status = 'completed') AS total_completed,
      -- مواعيد النهارده
      COUNT(a.id) FILTER (
        WHERE a.status = 'scheduled'
        AND a.appointment_time::date = CURRENT_DATE
      ) AS todays_count
    FROM users u
    LEFT JOIN specializations s ON s.id = u.specialization_id
    LEFT JOIN appointments a    ON a.doctor_id = u.id
    WHERE ${conditions.join(' AND ')}
    GROUP BY u.id, s.name, s.id
    ORDER BY u.full_name ASC
  `;

  const result = await client.query(sql, params);
  return result.rows;
};

// ─── 2. دكتور واحد بالتفصيل ──────────────────────────────────
const getDoctorById = async (client, doctorId) => {
  const sql = `
    SELECT
      u.id,
      u.full_name,
      u.phone,
      u.email,
      s.name AS specialization,
      s.id   AS specialization_id
    FROM users u
    LEFT JOIN specializations s ON s.id = u.specialization_id
    WHERE u.id         = $1
      AND u.role       = 'doctor'
      AND u.is_deleted = FALSE
      AND u.is_active  = TRUE
  `;

  const result = await client.query(sql, [doctorId]);
  return result.rows[0] || null;
};

// ─── 3. مواعيد الدكتور الفاضية ───────────────────────────────
const getDoctorAvailableSlots = async (client, doctorId, date) => {
  // جيب الـ availability بتاعت الدكتور لليوم ده
  const dayOfWeek = new Date(date).getDay();

  const availSql = `
    SELECT start_time, end_time
    FROM doctor_availability
    WHERE doctor_id   = $1
      AND day_of_week = $2
  `;

  const availResult = await client.query(availSql, [doctorId, dayOfWeek]);

  if (!availResult.rows[0]) return []; // مفيش availability للدكتور ده النهارده

  const { start_time, end_time } = availResult.rows[0];

  // جيب المواعيد المحجوزة في اليوم ده
  const bookedSql = `
    SELECT appointment_time, duration_minutes
    FROM appointments
    WHERE doctor_id  = $1
      AND appointment_time::date = $2::date
      AND status    != 'cancelled'
  `;

  const bookedResult = await client.query(bookedSql, [doctorId, date]);
  const booked       = bookedResult.rows;

  // اعمل slots كل 30 دقيقة
  const slots      = [];
  const slotDuration = 30;
  const dateStr    = date.split('T')[0];

  let current = new Date(`${dateStr}T${start_time}`);
  const end   = new Date(`${dateStr}T${end_time}`);

  while (current < end) {
    const slotEnd = new Date(current.getTime() + slotDuration * 60000);
    if (slotEnd > end) break;

    // تأكد إن الـ slot في المستقبل
    const isInFuture = current > new Date();

    // تأكد إن الـ slot مش محجوز
    const isBooked = booked.some(b => {
      const bStart = new Date(b.appointment_time);
      const bEnd   = new Date(bStart.getTime() + b.duration_minutes * 60000);
      return current < bEnd && slotEnd > bStart;
    });

    slots.push({
      time:      current.toISOString(),
      time_label: current.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true
      }),
      available: isInFuture && !isBooked,
    });

    current = slotEnd;
  }

  return slots;
};

// ─── 4. جيب كل التخصصات ─────────────────────────────────────
const getAllSpecializations = async (client) => {
  const result = await client.query(
    'SELECT id, name, description FROM specializations ORDER BY name'
  );
  return result.rows;
};

module.exports = {
  getDoctors,
  getDoctorById,
  getDoctorAvailableSlots,
  getAllSpecializations,
};