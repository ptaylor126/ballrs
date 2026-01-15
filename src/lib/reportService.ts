import { supabase } from './supabase';

// Report reasons
export const REPORT_REASONS = [
  'Inappropriate username',
  'Cheating',
  'Spam',
  'Other',
] as const;

export type ReportReason = typeof REPORT_REASONS[number];

/**
 * Submit a report about a user
 */
export async function reportUser(
  reporterId: string,
  reportedId: string,
  reason: ReportReason,
  details?: string
): Promise<{ success: boolean; error?: string }> {
  console.log('[reportService] reportUser called:', { reporterId, reportedId, reason, details });

  // Validate required fields
  if (!reporterId || !reportedId) {
    console.error('[reportService] Missing required IDs - reporterId:', reporterId, 'reportedId:', reportedId);
    return { success: false, error: 'Missing user IDs' };
  }

  try {
    const insertData = {
      reporter_id: reporterId,
      reported_id: reportedId,
      reason,
      details: details?.trim() || null,
    };
    console.log('[reportService] Inserting data:', insertData);

    const { error } = await supabase
      .from('user_reports')
      .insert(insertData);

    console.log('[reportService] Insert result - error:', error);

    if (error) {
      console.error('[reportService] Error submitting report:', error.message, error.details, error.hint);
      return { success: false, error: error.message };
    }

    console.log('[reportService] Report submitted successfully');
    return { success: true };
  } catch (err) {
    console.error('[reportService] Exception submitting report:', err);
    return { success: false, error: 'unexpected_error' };
  }
}
