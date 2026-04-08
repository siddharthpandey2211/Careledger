const pool = require('../config/db');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { isUuid } = require('../utils/validators');

async function createAllergy(req, res, next) {
  try {
    const { allergen, severity } = req.body;


    if (!allergen || !severity) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'Missing required fields: allergen, severity');
    }
    const validSeverity = ['mild', 'moderate', 'severe'];
    if (!validSeverity.includes(severity.toLowerCase())) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'severity must be one of: mild, moderate, severe');
    }

    const userId = req.user?.id;
    if (!userId) {
      return errorResponse(res, 401, 'UNAUTHORIZED', 'User context missing');
    }

    if (req.user?.role !== 'patient') {
      return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can add allergies');
    }

    const patientQuery = await pool.query(
      `SELECT id FROM patients WHERE user_id = $1`,
      [userId]
    );

    if (patientQuery.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found');
    }

    const patientId = patientQuery.rows[0].id;
    const existingAllergy = await pool.query(
      `SELECT id FROM allergies WHERE patient_id = $1 AND allergen ILIKE $2`,
      [patientId, allergen]
    );

    if (existingAllergy.rowCount > 0) {
      return errorResponse(res, 409, 'CONFLICT', 'This allergy already exists for this patient');
    }

    const inserted = await pool.query(
      `INSERT INTO allergies (patient_id, allergen, severity)
       VALUES ($1, $2, $3)
       RETURNING id, patient_id, allergen, severity`,
      [patientId, allergen, severity.toLowerCase()]
    );

    return successResponse(res, 201, inserted.rows[0], 'Allergy added successfully.');
  } catch (error) {
    return next(error);
  }
}



// get own allergy
const getOwnAllergy = async (req , res , next)=>{
  try {
    
    const userId = req.user?.id;
     if (!userId) {
       return errorResponse(res, 401, 'UNAUTHORIZED', 'User context missing');
     }
 
     if (req.user?.role !== 'patient') {
       return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can add allergies');
     }
 
     const patientQuery = await pool.query(
       `SELECT id FROM patients WHERE user_id = $1`,
       [userId]
     );
 
     if (patientQuery.rowCount === 0) {
       return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found');
     }
 
     const patientId = patientQuery.rows[0].id;
 
 
     //get all the allergy
     const getAllAllergy = await pool.query(
       `select id, patient_id, allergen, severity from allergies
       where patient_id = $1
       order by allergen asc`,
       [patientId]
     )

     return successResponse(res, 200, getAllAllergy.rows, 'Operation successful.');
  } catch (error) {
    return next(error);
  }
}



// update allergy
const updateAllergy = async (req , res , next) => {
  try {
    const id = req.params.id;
    if(!id || !isUuid(id)){
       return errorResponse(res, 400, 'VALIDATION_ERROR', 'id must be a valid UUID');
    }
  
     const {allergen , severity} = req.body;
  
    if (!allergen && !severity) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'At least one field must be provided for update');
    }
  
    const userId = req.user?.id;
    if (!userId) {
       return errorResponse(res, 401, 'UNAUTHORIZED', 'User context missing');
     }
  
     if (req.user?.role !== 'patient') {
       return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can add allergies');
     }
  
     const patientQuery = await pool.query(
       `SELECT id FROM patients WHERE user_id = $1`,
       [userId]
     );
  
     if (patientQuery.rowCount === 0) {
       return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found');
     }
     if(severity){
       const validSeverity = ['mild', 'moderate', 'severe'];
      if (!validSeverity.includes(severity.toLowerCase())) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', 'severity must be one of: mild, moderate, severe');
      }
     }
     const patientId = patientQuery.rows[0].id;

     // Fetch existing allergy details
     const fetchOldDetails = await pool.query(
      `select allergen, severity from allergies
      where id = $1 and patient_id = $2`,
      [id, patientId]
     )

     if (fetchOldDetails.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Allergy not found or access denied');
    }

     const finalallergen = allergen || fetchOldDetails.rows[0].allergen;
     const finalseverity = severity ? severity.toLowerCase() : fetchOldDetails.rows[0].severity;

   const updateAllergy = await pool.query(
    `update allergies
       set allergen = $1, severity = $2
       where id = $3
       returning id, patient_id, allergen, severity`,
      [finalallergen, finalseverity, id]
   )
   return successResponse(res, 200, updateAllergy.rows[0], 'Allergy updated successfully.');
    
  } catch (error) {
    return next(error);
  }


}

// delete allergy
const deleteAllergy = async (req , res ,next) =>{
  try{
   const { id } = req.params;
   
    if (!isUuid(id)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'id must be a valid UUID');
    }

   const userId = req.user?.id;
    if (!userId) {
       return errorResponse(res, 401, 'UNAUTHORIZED', 'User context missing');
     }
  
     if (req.user?.role !== 'patient') {
       return errorResponse(res, 403, 'FORBIDDEN', 'Only patients can add allergies');
     }
  
     const patientQuery = await pool.query(
       `SELECT id FROM patients WHERE user_id = $1`,
       [userId]
     );
  
     if (patientQuery.rowCount === 0) {
       return errorResponse(res, 404, 'NOT_FOUND', 'Patient profile not found');
     }
     const patientId = patientQuery.rows[0].id;

    // Delete allergy
    const deleted = await pool.query(
      `delete from allergies
      where id = $1 and patient_id = $2
      returning id`,
      [id, patientId]
    );

    if (deleted.rowCount === 0) {
      return errorResponse(res, 404, 'NOT_FOUND', 'Allergy not found or access denied');
    }

    return successResponse(res, 200, { id: deleted.rows[0].id }, 'Allergy deleted successfully.');
  } catch (error) {
    return next(error);
  }
}

//see patient allergy
const getPatientAllergy = async(req , res ,next) =>{
     try {
    const { patientId } = req.params;

    if (!isUuid(patientId)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'patientId must be a valid UUID');
    }

    const doctorId = req.doctor?.id;
    if (!doctorId) {
      return errorResponse(res, 403, 'FORBIDDEN', 'Doctor verification context missing');
    }

    // Check access permissions
    const access = await pool.query(
      `select id from access_permissions
       where patient_id = $1 and doctor_id = $2
       and status = 'active'
       and (expires_at is null or expires_at > now())`,
      [patientId, doctorId]
    );

    if (access.rowCount === 0) {
      return errorResponse(res, 403, 'FORBIDDEN', 'No active access permission for this patient');
    }

    const allergies = await pool.query(
      `select id, patient_id, allergen, severity
       from allergies
       where patient_id = $1
       order by severity desc, allergen asc`,
      [patientId]
    );

    return successResponse(res, 200, allergies.rows, 'Operation successful.');
  } catch (error) {
    return next(error);
  }
}


module.exports = {
  createAllergy, updateAllergy , getOwnAllergy , deleteAllergy , getPatientAllergy
}