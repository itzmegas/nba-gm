-- Metadata only. Execute through official MCP against the explicitly authorized project.
-- One statement gives one MVCC snapshot. No application records or gameplay RPCs.
WITH relations AS (
  SELECT c.*, n.nspname, pg_get_userbyid(c.relowner) AS owner
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','v','S')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass
      AND d.objid=c.oid AND d.deptype='e')
), functions AS (
  SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind='f'
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass
      AND d.objid=p.oid AND d.deptype='e')
)
SELECT jsonb_build_object(
  'server_version', current_setting('server_version'),
  'history', (SELECT jsonb_agg(jsonb_build_object('version',version,'name',name,
    'statements',statements) ORDER BY version) FROM supabase_migrations.schema_migrations),
  'relations', (SELECT jsonb_agg(jsonb_build_object('name',r.relname,'kind',r.relkind,
    'owner',r.owner,'rls',r.relrowsecurity,'force_rls',r.relforcerowsecurity,
    'options',r.reloptions,'view',CASE WHEN r.relkind='v' THEN pg_get_viewdef(r.oid,true) END,
    'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,
      'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
      'default',pg_get_expr(ad.adbin,ad.adrelid),'identity',a.attidentity,
      'generated',a.attgenerated,'collation',CASE WHEN a.attcollation<>t.typcollation THEN a.attcollation::regcollation::text END)
      ORDER BY a.attnum) FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid
      LEFT JOIN pg_attrdef ad ON ad.adrelid=a.attrelid AND ad.adnum=a.attnum
      WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped),
    'acl',(SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,
      'grantor',pg_get_userbyid(x.grantor),'privilege',x.privilege_type,'grantable',x.is_grantable)
      ORDER BY x.grantee,x.privilege_type)
      FROM aclexplode(coalesce(r.relacl,acldefault(CASE WHEN r.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,r.relowner))) x)
    ) ORDER BY r.relname) FROM relations r),
  'constraints',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',c.conname,
    'definition',pg_get_constraintdef(c.oid,true),'validated',c.convalidated)
    ORDER BY r.relname,c.conname) FROM pg_constraint c JOIN relations r ON r.oid=c.conrelid),
  'indexes',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',ic.relname,
    'definition',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid,'ready',i.indisready,
    'constraint',EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conindid=i.indexrelid AND c.contype IN ('p','u','x')))
    ORDER BY ic.relname) FROM pg_index i JOIN relations r ON r.oid=i.indrelid JOIN pg_class ic ON ic.oid=i.indexrelid),
  'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,
    'identity',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid),
    'owner',pg_get_userbyid(p.proowner),
    'acl',(SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,
      'grantor',pg_get_userbyid(x.grantor),'privilege',x.privilege_type,'grantable',x.is_grantable)
      ORDER BY x.grantee,x.privilege_type) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x))
    ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM functions p),
  'triggers',(SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',t.tgname,
    'definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) ORDER BY r.relname,t.tgname)
    FROM pg_trigger t JOIN relations r ON r.oid=t.tgrelid WHERE NOT t.tgisinternal),
  'policies',(SELECT jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,
    'permissive',permissive,'roles',roles,'command',cmd,'using',qual,'check',with_check)
    ORDER BY tablename,policyname) FROM pg_policies WHERE schemaname='public'),
  'enums',(SELECT jsonb_agg(e ORDER BY e->>'name') FROM (SELECT jsonb_build_object('name',t.typname,
    'labels',jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)) e FROM pg_type t
    JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid
    WHERE n.nspname='public' GROUP BY t.typname) s),
  'sequences',(SELECT jsonb_agg(jsonb_build_object('name',r.relname,'type',format_type(s.seqtypid,NULL),
    'start',s.seqstart::text,'increment',s.seqincrement::text,'min',s.seqmin::text,'max',s.seqmax::text,
    'cache',s.seqcache::text,'cycle',s.seqcycle) ORDER BY r.relname)
    FROM pg_sequence s JOIN relations r ON r.oid=s.seqrelid),
  'defaults',(SELECT jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),
    'schema',n.nspname,'type',d.defaclobjtype,'grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,
    'privilege',x.privilege_type,'grantable',x.is_grantable)
    ORDER BY d.defaclrole,d.defaclnamespace,d.defaclobjtype,x.grantee,x.privilege_type)
    FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
    CROSS JOIN LATERAL aclexplode(d.defaclacl) x WHERE n.nspname='public' OR d.defaclnamespace=0),
  'extensions',(SELECT jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname)
    ORDER BY e.extname) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace),
  'schema_acl',(SELECT jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(n.nspowner),
    'grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,
    'privilege',x.privilege_type,'grantable',x.is_grantable) ORDER BY x.grantee,x.privilege_type)
    FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) x WHERE n.nspname='public'),
  'publications',(SELECT jsonb_agg(jsonb_build_object('name',p.pubname,'all_tables',p.puballtables,
    'insert',p.pubinsert,'update',p.pubupdate,'delete',p.pubdelete,'truncate',p.pubtruncate,
    'tables',(SELECT jsonb_agg(schemaname||'.'||tablename ORDER BY schemaname,tablename)
      FROM pg_publication_tables WHERE pubname=p.pubname)) ORDER BY p.pubname) FROM pg_publication p)
) AS catalog;
