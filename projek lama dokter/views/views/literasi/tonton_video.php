<div class="container-fluid tm-container-content tm-mt-60">
    <div class="row mb-4">
        <h2 class="col-12 tm-text-primary"><?= $video['nama_video']; ?></h2>
    </div>
    <div class="row tm-mb-80">
        <div class="col-xl-8 col-lg-7 col-md-6 col-sm-12">
            <video autoplay loop controls id="tm-video">
                <source src="<?= base_url() ?>assets/plugin_video/video/<?= $video['file'] ?>" type="video/mp4">
            </video>
        </div>
        <div class="tm-bg-gray tm-video-details">
            <p class="mb-4">
                <?= $video['deskripsi']; ?>
            </p>

        </div>
    </div>

</div>