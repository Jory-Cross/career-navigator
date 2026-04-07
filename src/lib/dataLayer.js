import { base44 } from "@/api/base44Client";

/**
 * Data Access Layer
 * Centralized API for all data operations
 * All features read/write through here—not directly to entities
 */

export const DataLayer = {
  // CLIENT DATA

  async getClient(clientId) {
    const clients = await base44.entities.Client.list();
    return clients.find(c => c.id === clientId);
  },

  async updateClientData(clientId, data) {
    return base44.entities.Client.update(clientId, data);
  },

  async getClientAssessments(clientId) {
    const assessments = await base44.entities.Assessment.filter({
      client_id: clientId,
    });
    return assessments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async getClientVocationalFacts(clientId) {
    const client = await this.getClient(clientId);
    return client?.vocational_facts_profile || null;
  },

  // TIME ENTRIES

  async createTimeEntry(clientId, entryType, data) {
    const entry = await base44.entities.TimeEntry.create({
      client_id: clientId,
      entry_type_id: entryType,
      date: data.date,
      duration_minutes: data.duration_minutes || Math.round(data.duration_hours * 60),
      location: data.location,
      description: data.description,
    });

    // Create structured field answers
    if (data.structured_fields) {
      await base44.entities.ReportFieldAnswer.create({
        time_entry_id: entry.id,
        entry_type_id: entryType,
        entry_type_code: entryType,
        answers: data.structured_fields,
        is_complete: data.is_complete || false,
        submitted_at: data.submitted_at,
      });
    }

    return entry;
  },

  async getClientTimeEntries(clientId, filters = {}) {
    const query = { client_id: clientId };
    if (filters.entry_type) query.entry_type_id = filters.entry_type;
    if (filters.date_from) query.date = { $gte: filters.date_from };
    if (filters.date_to) query.date = { ...query.date, $lte: filters.date_to };

    return base44.entities.TimeEntry.filter(query);
  },

  async getTimeEntryStructuredData(timeEntryId) {
    const answers = await base44.entities.ReportFieldAnswer.filter({
      time_entry_id: timeEntryId,
    });
    return answers[0] || null;
  },

  // JOB RECOMMENDATIONS

  async createJobRecommendation(clientId, recommendation) {
    return base44.entities.JobRecommendation.create({
      client_id: clientId,
      job_title: recommendation.job_title,
      employer: recommendation.employer,
      location: recommendation.location,
      job_url: recommendation.source_url,
      fit_score: recommendation.fit_score || 0,
      fit_reason: recommendation.fit_reason,
      support_needs: recommendation.support_needs || [],
      barriers_identified: recommendation.barriers || [],
      status: "suggested",
      generated_by: recommendation.generated_by,
      assessments_used: recommendation.assessments_used || [],
      client_fields_used: recommendation.client_fields_used || [],
      batch_id: recommendation.batch_id,
    });
  },

  async getClientRecommendations(clientId, filters = {}) {
    const query = { client_id: clientId };
    if (filters.status) query.status = filters.status;
    if (filters.batch_id) query.batch_id = filters.batch_id;

    const recs = await base44.entities.JobRecommendation.filter(query);
    return recs.sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0));
  },

  async updateRecommendationStatus(recommendationId, status) {
    return base44.entities.JobRecommendation.update(recommendationId, { status });
  },

  // ASSESSMENTS

  async createAssessment(clientId, assessmentType, responses, extractedFacts = null) {
    const assessment = await base44.entities.Assessment.create({
      client_id: clientId,
      assessment_type: assessmentType,
      responses,
      extracted_facts: extractedFacts,
      completed_by: (await base44.auth.me()).email,
    });

    // Link to client
    const client = await this.getClient(clientId);
    const linked = client.assessments_linked || [];
    if (!linked.includes(assessment.id)) {
      await this.updateClientData(clientId, {
        assessments_linked: [...linked, assessment.id],
      });
    }

    return assessment;
  },

  async getAssessment(assessmentId) {
    const assessments = await base44.entities.Assessment.list();
    return assessments.find(a => a.id === assessmentId);
  },

  async updateAssessmentWithExtractedFacts(assessmentId, extractedFacts) {
    return base44.entities.Assessment.update(assessmentId, {
      extracted_facts: extractedFacts,
    });
  },

  // DOCUMENTS

  async createClientDocument(clientId, document) {
    return base44.entities.Document.create({
      client_id: clientId,
      title: document.title,
      file_url: document.file_url,
      file_name: document.file_name,
      category: document.type || "other",
      tags: document.tags || [],
      notes: document.notes,
    });
  },

  async getClientDocuments(clientId, type = null) {
    const documents = await base44.entities.Document.filter({
      client_id: clientId,
      is_archived: false,
    });

    if (type) {
      return documents.filter(d => d.category === type);
    }
    return documents.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  },

  // REPORTS

  async createReportBatch(batchData) {
    return base44.entities.ReportBatch.create({
      pdf_template_id: batchData.pdf_template_id,
      entry_type: batchData.entry_type,
      date_range_start: batchData.date_from,
      date_range_end: batchData.date_to,
      client_ids: batchData.client_ids,
      status: "processing",
      created_by: (await base44.auth.me()).email,
      created_at: new Date().toISOString(),
    });
  },

  async updateReportBatch(batchId, updates) {
    return base44.entities.ReportBatch.update(batchId, updates);
  },

  // UTILITY

  async contextForClient(clientId) {
    /**
     * Returns complete client context for AI agents and reports
     * Single query for all related data
     */
    const [client, assessments, timeEntries, recommendations, documents] = await Promise.all([
      this.getClient(clientId),
      this.getClientAssessments(clientId),
      this.getClientTimeEntries(clientId),
      this.getClientRecommendations(clientId),
      this.getClientDocuments(clientId),
    ]);

    // Enrich time entries with structured data
    const enrichedTimeEntries = await Promise.all(
      timeEntries.map(async (te) => ({
        ...te,
        structured_data: await this.getTimeEntryStructuredData(te.id),
      }))
    );

    return {
      client,
      assessments,
      timeEntries: enrichedTimeEntries,
      recommendations,
      documents,
      vocationalFacts: client?.vocational_facts_profile,
    };
  },

  async buildReportContext(clientId, dateFrom, dateTo, entryType) {
    /**
     * Context for report generation
     */
    const client = await this.getClient(clientId);
    const timeEntries = await this.getClientTimeEntries(clientId, {
      entry_type: entryType,
      date_from: dateFrom,
      date_to: dateTo,
    });

    const enrichedEntries = await Promise.all(
      timeEntries.map(async (te) => ({
        ...te,
        answers: await this.getTimeEntryStructuredData(te.id),
      }))
    );

    return {
      client,
      timeEntries: enrichedEntries,
      entryType,
      dateFrom,
      dateTo,
    };
  },
};