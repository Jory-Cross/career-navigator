/**
 * Transportation section extraction.
 * Answer keys: transportation_method, has_license, has_vehicle, transportation_notes, 
 *              available_days, available_hours, schedule_notes
 * 
 * Maps to VFP:
 * - transportation_reliability
 * - transportation_limitations
 * - schedule_constraints
 * - work_availability
 * - support_needs
 */

export function extractTransportationByAnswerKey(answers) {
  const extracted = {};
  const text = Object.values(answers || {}).join(' ').toLowerCase();

  // transportation_reliability
  const hasVehicle = answers.has_vehicle || text.includes('own') || text.includes('car');
  const hasLicense = answers.has_license || text.includes('license');
  const method = (answers.transportation_method || '').toLowerCase();

  if (hasVehicle && hasLicense) {
    extracted.transportation_reliability = ['reliable_personal_vehicle'];
  } else if (method.includes('public') || method.includes('transit')) {
    extracted.transportation_reliability = ['relies_on_public_transit'];
  } else if (hasVehicle || text.includes('sometimes')) {
    extracted.transportation_reliability = ['sometimes_available'];
  } else if (!hasVehicle || text.includes('no car') || text.includes('cannot drive')) {
    extracted.transportation_reliability = ['unreliable_no_vehicle'];
  }

  // transportation_limitations
  const limitations = [];
  if (!hasLicense || text.includes('no license')) limitations.push('no_driver_license');
  if (!hasVehicle || text.includes('no car')) limitations.push('no_personal_vehicle');
  if (text.includes('mobility') || text.includes('wheelchair')) limitations.push('mobility_access_needed');
  if (text.includes('cost') || text.includes('afford')) limitations.push('cost_prohibitive');
  if (text.includes('distance') || text.includes('far')) limitations.push('distance_barrier');
  if (limitations.length) extracted.transportation_limitations = limitations;

  // schedule_constraints from available_days, available_hours, schedule_notes
  const constraints = [];
  const availDays = (answers.available_days || '').toLowerCase();
  const availHours = (answers.available_hours || '').toLowerCase();
  const schedNotes = (answers.schedule_notes || '').toLowerCase();

  if (availDays === 'weekdays' || availDays.includes('weekday')) {
    constraints.push('weekdays_only');
  } else if (availDays === 'weekends' || availDays.includes('weekend')) {
    constraints.push('weekends_only');
  }

  if (availHours === 'morning' || schedNotes.includes('morning')) constraints.push('morning_preferred');
  if (availHours === 'afternoon' || schedNotes.includes('afternoon')) constraints.push('afternoon_preferred');
  if (availHours === 'evening' || schedNotes.includes('evening')) constraints.push('evening_preferred');
  if (schedNotes.includes('no overnight') || schedNotes.includes('no night')) constraints.push('no_overnight_shifts');
  if (schedNotes.includes('childcare') || schedNotes.includes('pickup')) constraints.push('childcare_hours');
  if (constraints.length) extracted.schedule_constraints = constraints;

  // work_availability - infer from schedule
  if (availHours && availHours !== 'flexible') {
    extracted.work_availability = [availHours];
  } else if (!constraints.length && (hasVehicle || method.includes('public'))) {
    extracted.work_availability = ['flexible'];
  }

  // support_needs for transportation
  const needs = [];
  if (!hasVehicle) needs.push('transportation_assistance');
  if (!hasLicense) needs.push('transportation_training');
  if (text.includes('transit')) needs.push('public_transit_access');
  if (text.includes('carpool')) needs.push('carpool_coordination');
  if (limitations.length) needs.push('transportation_planning');
  if (needs.length) extracted.support_needs = needs;

  return extracted;
}