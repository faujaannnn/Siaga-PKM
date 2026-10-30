<div class="container-fluid tm-container-content tm-mt-60">
    <div class="row mb-4">
        <h2 class="col-12 tm-text-primary"><?= $materi['nama_materi'] ?></h2>
    </div>
    <div class="row tm-mb-90">
        <div class="col-xl-8 col-lg-7 col-md-6 col-sm-12">
            <div class="card">
                <div class="card-body p-3">
                    <iframe style="width: 100%; height: 774px;" src="<?php echo base_url() ?>assets/plugin_video/materi/<?= $materi['file'] ?>" type="application/pdf"></iframe>
                </div>
            </div>
        </div>
        <div class="col-xl-4 col-lg-5 col-md-6 col-sm-12">
            <div class="tm-bg-gray tm-video-details">
                <p class="mb-4">
                    <?= $materi['deskripsi']; ?> </p>

            </div>
        </div>
    </div>


</div> <!-- container-fluid, tm-container-content -->