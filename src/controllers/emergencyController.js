const pool = require('../config/db');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { isUuid } = require('../utils/validators');


async function addEmergencyInfo(req, res, next) {
  try {
    const { contact_name, contact_phone, contact_relationship , contact_email } = req.body;

    if (!contact_name || !contact_phone || !contact_email) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'Missing required fields: contact_name, contact_phone');
    }

    const userId = req.user?.id;
    if (!userId) {
      return errorResponse(res, 401, 'UNAUTHORIZED', 'User context missing');
    }

    if (req.user?.role !== 'patient') {
      return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can manage emergency info');
    }

    const patientQuery = await pool.query(
      `select id from patients where user_id = $1`,
      [userId]
    );

    if (patientQuery.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found');
    }

    const patientId = patientQuery.rows[0].id;


    const addInfo = await pool.query(
      `insert into emergency_info (patient_id, contact_name, contact_phone, contact_relationship, contact_email)
       values ($1, $2, $3, $4, $5)
       returning id, patient_id, contact_name, contact_phone, contact_relationship, contact_email`,
      [patientId, contact_name, contact_phone, contact_relationship || null, contact_email]
    );

    return successResponse(res, 200, addInfo.rows[0], 'Emergency info saved successfully.');
  } catch (error) {
    return next(error);
  }
}


const getEmergencyInfo = async (req , res , next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
          return errorResponse(res, 401, 'UNAUTHORIZED', 'User context missing');
        }
    
        if (req.user?.role !== 'patient') {
          return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can manage emergency info');
        }
    
        const patientQuery = await pool.query(
          `select id from patients where user_id = $1`,
          [userId]
        );
    
        if (patientQuery.rowCount === 0) {
          return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found');
        }
    
        const patientId = patientQuery.rows[0].id;
    
        const getInfo = await pool.query(
            `select patient_id as patientId, json_agg(
              json_build_object(
                'emergency_email',contact_email,
                'emergency_name',contact_name,
                'emergency_phone_number',contact_phone
              )
            ) as emergency_details
             from emergency_info
             where patient_id = $1
             group by patient_id` , [patientId]
        )

        return successResponse(res, 200, getInfo.rows[0], 'Operation successful.'); 
    } catch (error) {
        return next(error);
    }
}



const updateEmergencyInfo = async ( req , res, next) => {
    try {
        
        const userId = req.user?.id;
            if (!userId) {
              return errorResponse(res, 401, 'UNAUTHORIZED', 'User context missing');
            }
        
            if (req.user?.role !== 'patient') {
              return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can manage emergency info');
            }
        
            const patientQuery = await pool.query(
              `select id from patients where user_id = $1`,
              [userId]
            );
        
            if (patientQuery.rowCount === 0) {
              return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found');
            }
        
            const patientId = patientQuery.rows[0].id;


        const id = req.params.id;
        if(!id || !isUuid(id)){
            return errorResponse(res, 400, 'VALIDATION_ERROR', 'id must be a valid UUID');
        }

        const exist = await pool.query(
            `select * from emergency_info where id = $1 and patient_id = $2` , [id, patientId]
        )

        if(exist.rowCount === 0){
            return errorResponse(res, 404, 'NOT_FOUND', 'Emergency contact not found');
        }


        const {contact_name, contact_phone, contact_relationship , contact_email} = req.body;
    
        const finalContact_name = contact_name || exist.rows[0].contact_name;
            const finalContact_phone = contact_phone || exist.rows[0].contact_phone;
                const finalContact_relationship = contact_relationship || exist.rows[0].contact_relationship;
                    const finalContact_email = contact_email || exist.rows[0].contact_email;
    
        const update = await pool.query(
            `update emergency_info
            set contact_name = $1 , contact_phone = $2 , contact_relationship = $3 , contact_email = $4
            where id = $5
            returning id, contact_name, contact_phone, contact_relationship, contact_email` , [finalContact_name , finalContact_phone , finalContact_relationship , finalContact_email , id]
        )

        return successResponse(res, 200, update.rows[0], 'Emergency info updated successfully.');
    } catch (error) {
        return next(error)
    }
    
}


const deleteEmergencyInfo = async (req , res, next) => {
    try {
        const userId = req.user?.id;
            if (!userId) {
              return errorResponse(res, 401, 'UNAUTHORIZED', 'User context missing');
            }
        
            if (req.user?.role !== 'patient') {
              return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can manage emergency info');
            }
        
            const patientQuery = await pool.query(
              `select id from patients where user_id = $1`,
              [userId]
            );
        
            if (patientQuery.rowCount === 0) {
              return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found');
            }
        
            const patientId = patientQuery.rows[0].id;


        const id = req.params.id;
        if(!id || !isUuid(id)){
            return errorResponse(res, 400, 'VALIDATION_ERROR', 'id must be a valid UUID');
        }

        const exist = await pool.query(
            `select * from emergency_info where id = $1 and patient_id = $2` , [id, patientId]
        )

        if(exist.rowCount === 0){
            return errorResponse(res, 404, 'NOT_FOUND', 'Emergency contact not found');
        }

        const deleted = await pool.query(
            `delete from emergency_info where id = $1 and patient_id = $2` , [id , patientId])

        return successResponse(res, 200, null, 'Emergency info deleted successfully.');
    } catch (error) {
        return next(error)
    }
}


const getPatientEmergencyInfo = async (req , res , next) => {
    try {
        const { patientId } = req.params;

        if (!isUuid(patientId)) {
          return errorResponse(res, 400, 'VALIDATION_ERROR', 'patientId must be a valid UUID');
        }

        const doctorId = req.doctor?.id;
        if (!doctorId) {
          return errorResponse(res, 403, 'FORBIDDEN', 'Doctor verification context missing');
        }

        const access = await pool.query(
          `select id from access_permissions
           where patient_id = $1 and doctor_id = $2 and status = 'active' and (expires_at is null or expires_at > now())`,
          [patientId, doctorId]
        );

        if (access.rowCount === 0) {
          return errorResponse(res, 403, 'FORBIDDEN', 'No active access permission for this patient');
        }

        const getInfo = await pool.query(
            `select patient_id as patientId, json_agg(
              json_build_object(
                'emergency_email',contact_email,
                'emergency_name',contact_name,
                'emergency_phone_number',contact_phone
              )
            ) as emergency_details
             from emergency_info
             where patient_id = $1
             group by patient_id` , [patientId]
        )

        if (getInfo.rowCount === 0) {
          return errorResponse(res, 404, 'NOT_FOUND', 'Emergency info not found');
        }

        return successResponse(res, 200, getInfo.rows[0], 'Operation successful.');
    } catch (error) {
        return next(error);
    }
}


module.exports = {
    addEmergencyInfo,
    getEmergencyInfo,
    updateEmergencyInfo,
    deleteEmergencyInfo,
    getPatientEmergencyInfo
};