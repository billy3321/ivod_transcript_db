def run_retry():
    br = make_browser()
    db = Session()

    MAX = 5
    # 找 ai 失敗，且還沒超過重試上限
    to_retry = db.query(IVODTranscript).filter(
        IVODTranscript.ai_status=='failed',
        IVODTranscript.ai_retries < MAX
    ).all()
    # 同 ly
    to_retry += db.query(IVODTranscript).filter(
        IVODTranscript.ly_status=='failed',
        IVODTranscript.ly_retries < MAX
    ).all()

    for obj in to_retry:
        rec = process_ivod(br, obj.ivod_id, db)
        db.commit()

    db.close()