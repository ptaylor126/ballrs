import { supabase } from './supabase';
import * as ImageManipulator from 'expo-image-manipulator';

export interface Feedback {
  id: string;
  user_id: string | null;
  username: string | null;
  message: string;
  image_url: string | null;
  created_at: string;
}

// Compress and resize image before upload (max 1024px width, ~1MB)
export async function compressImage(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch (error) {
    console.error('Error compressing image:', error);
    // Return original URI if compression fails
    return uri;
  }
}

// Upload image to Supabase Storage
export async function uploadFeedbackImage(
  uri: string,
  userId: string | null
): Promise<string | null> {
  try {
    // Compress the image first
    const compressedUri = await compressImage(uri);

    // Create a unique filename
    const timestamp = Date.now();
    const userPrefix = userId || 'anonymous';
    const filename = `${userPrefix}_${timestamp}.jpg`;

    // Fetch the image as a blob
    const response = await fetch(compressedUri);
    const blob = await response.blob();

    // Convert blob to array buffer for Supabase
    const arrayBuffer = await new Response(blob).arrayBuffer();

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('feedback-images')
      .upload(filename, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading feedback image:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('feedback-images')
      .getPublicUrl(filename);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadFeedbackImage:', error);
    return null;
  }
}

// Submit feedback to database
export async function submitFeedback(
  userId: string | null,
  username: string | null,
  message: string,
  imageUri: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    let imageUrl: string | null = null;

    // Upload image if provided
    if (imageUri) {
      imageUrl = await uploadFeedbackImage(imageUri, userId);
      // Continue even if image upload fails - still save the feedback
    }

    // Insert feedback record
    const { error } = await supabase
      .from('feedback')
      .insert({
        user_id: userId,
        username: username,
        message: message,
        image_url: imageUrl,
      });

    if (error) {
      console.error('Error submitting feedback:', error);
      return { success: false, error: 'Failed to submit feedback. Please try again.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in submitFeedback:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
