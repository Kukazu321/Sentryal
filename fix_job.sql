UPDATE jobs SET status = 'FAILED', error_message = 'asf_search was missing - fixed' WHERE status = 'PROCESSING';
