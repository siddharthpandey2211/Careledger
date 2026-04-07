const pool = require('../config/db');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { isUuid } = require('../utils/validators');




const addClinicData = async (req , res , next) => {
    try{
        //cheack the doctor
        const doctorId = req.doctor?.id;
        if(!doctorId || !isUuid(doctorId)){
            return errorResponse(res, 403, 'FORBIDDEN', 'Doctor verification context missing');
        }

        const {clinicName , address , logoURL , email , phone} = req.body;

        if(!clinicName || !address || !email || !phone){
            return errorResponse(res, 400, 'BAD_REQUEST', 'Missing required fields: clinicName, address, email, phone');
        }

        //chech if it already exist

        const check = await pool.query(`
            select id from clinics
            where clinic_name = $1 and address = $2 and doctor_id = $3`,[clinicName , address , doctorId]);

        if(check.rowCount > 0){
            return errorResponse(res, 409, 'CONFLICT', 'Clinic already exists at this address');
        }

        const create = await pool.query(
            `insert into clinics(doctor_id , clinic_name , address , logo_url , email , phone)
            values ($1 , $2 , $3 , $4 , $5 , $6)
            returning doctor_id , clinic_name , address , logo_url , email , phone`,[doctorId , clinicName , address , logoURL , email , phone]
        )

        return successResponse(res, 201, create.rows[0], 'Clinic added successfully.');
    }catch(error){
        return next(error);
    }

}


const getAllClinics = async (req , res , next) =>{
    try {
        const doctorId = req.doctor?.id;
        if(!doctorId || !isUuid(doctorId)){
            return errorResponse(res, 403, 'FORBIDDEN', 'Doctor verification context missing');
        }

        const getClinics = await pool.query(
            `select id ,clinic_name , address , logo_url , email , phone
            from clinics
            where doctor_id = $1` , [doctorId]
        )

        return successResponse(res, 200, getClinics.rows, 'Operation successful.');
    } catch (error) {
        return next(error);
    }
}


const getSingleClinic = async (req , res, next) =>{
    try {
        const doctorId = req.doctor?.id;
        if(!doctorId || !isUuid(doctorId)){
            return errorResponse(res, 403, 'FORBIDDEN', 'Doctor verification context missing');
        }

        const clinicId = req.params.id;

        if(!clinicId || !isUuid(clinicId)){
            return errorResponse(res, 400, 'VALIDATION_ERROR', 'clinicId must be a valid UUID');
        }

        const getClinic = await pool.query(
         `select id ,clinic_name , address , logo_url , email , phone
            from clinics
            where doctor_id = $1 and id = $2` , [doctorId , clinicId]
        )

        if(getClinic.rowCount === 0){
            return errorResponse(res, 404, 'NOT_FOUND', 'Clinic not found');
        }

        return successResponse(res, 200, getClinic.rows[0], 'Operation successful.');
    } catch (error) {
        return next(error)
    }
}


const updateClinic = async(req , res , next) => {
   try {
       const doctorId = req.doctor?.id;
        if(!doctorId || !isUuid(doctorId)){
            return errorResponse(res, 403, 'FORBIDDEN', 'Doctor verification context missing');
        }

        const clinicId = req.params.id;

        if(!clinicId || !isUuid(clinicId)){
            return errorResponse(res, 400, 'VALIDATION_ERROR', 'clinicId must be a valid UUID');
        }

        const doesExist = await pool.query(
            `select id ,clinic_name , address , logo_url , email , phone
            from clinics
            where doctor_id = $1 and id = $2` , [doctorId , clinicId]
        )

        if(doesExist.rowCount === 0){
            return errorResponse(res, 404, 'NOT_FOUND', 'Clinic not found');
        }

        const {clinicName , address , logoURL , email , phone} = req.body;

        const finalClinicName = clinicName || doesExist.rows[0].clinic_name;
        const finaladdress = address || doesExist.rows[0].address;
        const finalemail = email || doesExist.rows[0].email
        const finalphone = phone || doesExist.rows[0].phone
        const finallogoURL = logoURL || doesExist.rows[0].logo_url;

        const update = await pool.query(
            `update clinics
            set clinic_name = $1 , address = $2 , logo_url = $3 , email = $4 , phone = $5 , updated_at = now()
            where id = $6 and doctor_id = $7
            returning id, clinic_name, address, logo_url, email, phone` , [finalClinicName , finaladdress , finallogoURL , finalemail , finalphone , clinicId , doctorId]
        )

        return successResponse(res, 200, update.rows[0], 'Clinic updated successfully.');
   } catch (error) {
      return next(error)
   }
}


const deleteClinic = async (req , res, next) =>{
    try {

        const doctorId = req.doctor?.id;
            if(!doctorId || !isUuid(doctorId)){
                return errorResponse(res, 403, 'FORBIDDEN', 'Doctor verification context missing');
            }

            const clinicId = req.params.id;

            if(!clinicId || !isUuid(clinicId)){
                return errorResponse(res, 400, 'VALIDATION_ERROR', 'clinicId must be a valid UUID');
            }

            const doesExist = await pool.query(
                `select id ,clinic_name , address , logo_url , email , phone
                from clinics
                where doctor_id = $1 and id = $2` , [doctorId , clinicId]
            )

            if(doesExist.rowCount === 0){
                return errorResponse(res, 404, 'NOT_FOUND', 'Clinic not found');
            }

            const deleted = await pool.query(
                `delete from clinics
                where id = $1` , [clinicId]
            )

            return successResponse(res, 200, null, 'Clinic deleted successfully.');
    } catch (error) {
        return next(error)
    }


}


module.exports = {
    addClinicData,
    getAllClinics,
    getSingleClinic,
    updateClinic,
    deleteClinic
};