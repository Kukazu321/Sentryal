SELECT 
  COUNT(*) as total_deformations,
  (SELECT COUNT(*) FROM deformations WHERE job_id = (SELECT id FROM jobs WHERE infrastructure_id = '270e738d-056c-49e9-abda-59dc89754676' LIMIT 1)) as job_deformations
FROM deformations;
