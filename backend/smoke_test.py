import json
import urllib.request
import urllib.error

BASE = "http://localhost:4000/api"


def call(method, path, body=None, token=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw.decode()


def check(label, cond, extra=""):
    status = "OK" if cond else "FAIL"
    print(f"[{status}] {label} {extra}")
    if not cond:
        raise SystemExit(1)


# 1. Register patient, doctor, guardian
s, patient = call("POST", "/auth/register", {
    "email": "asha.patient@example.com", "password": "password123",
    "fullName": "Asha Rao", "role": "patient"
})
check("register patient", s == 201, patient)
patient_token = patient["token"]
patient_id = patient["user"]["id"]

s, doctor = call("POST", "/auth/register", {
    "email": "dr.mehta@example.com", "password": "password123",
    "fullName": "Dr. Rohan Mehta", "role": "doctor", "specialization": "Geriatrics", "hospital": "City Hospital"
})
check("register doctor", s == 201, doctor)
doctor_token = doctor["token"]
doctor_id = doctor["user"]["id"]

s, guardian = call("POST", "/auth/register", {
    "email": "rahul.son@example.com", "password": "password123",
    "fullName": "Rahul Kumar", "role": "guardian"
})
check("register guardian", s == 201, guardian)
guardian_token = guardian["token"]

# 2. Patient profile update
s, prof = call("PUT", "/patients/me", {"bloodGroup": "O+", "dob": "1958-04-12", "phone": "9990001111"}, patient_token)
check("update patient profile", s == 200, prof)

# 3. Medical condition + allergy
s, cond = call("POST", f"/patients/{patient_id}/conditions", {"name": "Hypertension", "status": "active"}, patient_token)
check("add condition", s == 201, cond)

s, alg = call("POST", f"/patients/{patient_id}/allergies", {"type": "medicine", "name": "Penicillin", "severity": "severe"}, patient_token)
check("add allergy", s == 201, alg)

# 4. Appointment linking doctor to patient (so doctor gets clinical access)
s, appt = call("POST", f"/patients/{patient_id}/appointments", {"doctorUserId": doctor_id, "dateTime": "2026-10-01T10:00:00+05:30", "reason": "Routine checkup"}, patient_token)
check("book appointment", s == 201, appt)

# 5. Doctor writes a prescription
s, rx = call("POST", f"/patients/{patient_id}/prescriptions", {
    "date": "2026-10-01", "diagnosis": "Hypertension follow-up",
    "items": [{"medicineName": "Amlodipine", "dosage": "5mg", "frequency": "Once daily"}]
}, doctor_token)
check("doctor creates prescription", s == 201, rx)

# 6. Medication schedule + today's doses + logging a dose
s, med = call("POST", f"/patients/{patient_id}/medications", {
    "name": "Amlodipine", "dosage": "5mg", "scheduleTimes": ["08:00", "20:00"], "startDate": "2026-09-20", "durationDays": 30
}, patient_token)
check("create medication", s == 201, med)

s, today = call("GET", f"/patients/{patient_id}/medications/today", None, patient_token)
check("medications today list", s == 200 and isinstance(today, list), today)
if today:
    dose = today[0]
    s, logres = call("POST", f"/patients/{patient_id}/medications/{dose['medicationId']}/log", {
        "scheduledDate": dose["scheduledDate"], "scheduledTime": dose["scheduledTime"], "status": "taken"
    }, patient_token)
    check("log dose taken", s == 200, logres)

# 7. Guardian invite -> accept -> permissions -> consent view
s, inv = call("POST", f"/patients/{patient_id}/guardians", {"guardianEmail": "rahul.son@example.com", "relationship": "Son"}, patient_token)
check("invite guardian", s == 201, inv)
guardian_link_id = inv["id"]

s, mine = call("GET", "/guardians/my-patients", None, guardian_token)
check("guardian sees pending invite", s == 200 and len(mine) == 1, mine)

s, accepted = call("PUT", f"/guardians/{guardian_link_id}/accept", None, guardian_token)
check("guardian accepts invite", s == 200 and accepted["status"] == "active", accepted)

s, perm = call("PUT", f"/patients/{patient_id}/guardians/{guardian_link_id}/permissions", {
    "permissions": {"medicines": True, "appointments": True}
}, patient_token)
check("patient sets guardian permissions", s == 200 and perm["permissions"]["medicines"] is True, perm)

s, guardMeds = call("GET", f"/patients/{patient_id}/medications", None, guardian_token)
check("guardian can view medications after consent", s == 200, guardMeds)

s, guardAllergies = call("GET", f"/patients/{patient_id}/allergies", None, guardian_token)
check("guardian blocked from allergies (no reports consent)", s == 403, guardAllergies)

s, consent = call("GET", f"/patients/{patient_id}/consent", None, patient_token)
check("consent overview lists guardian + doctor", s == 200 and len(consent["guardians"]) == 1 and len(consent["doctors"]) == 1, consent)

# 8. Emergency contacts + emergency profile
s, ec = call("POST", f"/patients/{patient_id}/emergency-contacts", {"name": "Rahul Kumar", "relationship": "Son", "phone": "9990002222", "priority": 1}, patient_token)
check("add emergency contact", s == 201, ec)

s, emerg = call("GET", f"/patients/{patient_id}/emergency-profile", None, guardian_token)
check("guardian can view emergency profile", s == 200 and emerg["profile"]["blood_group"] == "O+", emerg)

s, sos = call("POST", f"/patients/{patient_id}/sos", None, patient_token)
check("sos trigger", s == 200 and len(sos["notifying"]) == 1, sos)

# 9. Audit log
s, audit = call("GET", f"/patients/{patient_id}/audit-log", None, patient_token)
check("audit log recorded activity", s == 200 and len(audit) > 0, f"({len(audit)} entries)")

# 10. Revoke guardian, confirm access removed
s, rev = call("DELETE", f"/patients/{patient_id}/guardians/{guardian_link_id}", None, patient_token)
check("revoke guardian", s == 200 and rev["status"] == "revoked", rev)

s, blocked = call("GET", f"/patients/{patient_id}/medications", None, guardian_token)
check("guardian loses access after revoke", s == 403, blocked)

print("\nALL SMOKE TESTS PASSED")
