/**
 * Prescription Service - Handles database operations for prescriptions
 */

const pool = require('../config/db');

class PrescriptionService {
    /**
     * Save prescription and its drugs to database
     * @param {Object} prescriptionData - Prescription data from OCR
     * @param {string} consultation_id - Consultation ID (optional)
     * @param {string} patient_id - Patient ID (optional)
     * @param {string} doctor_id - Doctor ID (optional)
     * @returns {Promise<string>} - Prescription ID
     */
    static async savePrescription(prescriptionData, consultation_id, patient_id, doctor_id) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Save prescription
            const prescriptionQuery = `
                INSERT INTO prescriptions (consultation_id, patient_id, doctor_id, issued_at)
                VALUES ($1, $2, $3, NOW())
                RETURNING id;
            `;

            const prescriptionResult = await client.query(prescriptionQuery, [
                consultation_id || null,
                patient_id || null,
                doctor_id || null
            ]);

            const prescriptionId = prescriptionResult.rows[0].id;
            console.log('[PRESCRIPTION_SERVICE] Saved prescription ID:', prescriptionId);

            // Save prescription items (drugs)
            if (prescriptionData.drugs && prescriptionData.drugs.length > 0) {
                const itemQuery = `
                    INSERT INTO prescription_items 
                    (prescription_id, drug_name, dosage, frequency, duration_days)
                    VALUES ($1, $2, $3, $4, $5);
                `;

                for (const drug of prescriptionData.drugs) {
                    await client.query(itemQuery, [
                        prescriptionId,
                        drug.drug_name,
                        drug.dosage,
                        drug.frequency,
                        drug.duration_days
                    ]);
                }

                console.log(`[PRESCRIPTION_SERVICE] Saved ${prescriptionData.drugs.length} prescription items`);
            }

            // Commit transaction
            await client.query('COMMIT');

            return prescriptionId;

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Get prescription by ID with all items
     * @param {string} prescriptionId - Prescription ID
     * @returns {Promise<Object>} - Prescription with items
     */
    static async getPrescriptionWithItems(prescriptionId) {
        const query = `
            SELECT 
                p.id,
                p.consultation_id,
                p.patient_id,
                p.doctor_id,
                p.issued_at,
                p.created_at,
                p.updated_at,
                json_agg(
                    json_build_object(
                        'id', pi.id,
                        'drug_name', pi.drug_name,
                        'dosage', pi.dosage,
                        'frequency', pi.frequency,
                        'duration_days', pi.duration_days
                    )
                ) as items
            FROM prescriptions p
            LEFT JOIN prescription_items pi ON p.id = pi.prescription_id
            WHERE p.id = $1
            GROUP BY p.id
        `;

        const result = await pool.query(query, [prescriptionId]);
        return result.rows[0] || null;
    }
}

module.exports = PrescriptionService;
