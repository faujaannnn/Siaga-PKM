<div class="container-fluid tm-container-content tm-mt-60">
    <div class="row mb-4">
        <h2 class="col-6 tm-text-primary">
            Daftar Materi
        </h2>

    </div>
    <div class="row tm-mb-90 tm-gallery">
        <?php foreach ($materi as $m): ?>
            <div class="col-xl-3 col-lg-4 col-md-6 col-sm-6 col-12 mb-5">
                <figure class="effect-ming tm-video-item">
                    <img src="<?= base_url() ?>assets/plugin_video/img/<?= $m->gambar ?>" alt="Image" class="img-fluid">
                    <figcaption class="d-flex align-items-center justify-content-center">
                        <h2><?= $m->nama_materi; ?></h2>
                        <a href="<?= site_url('Literasi/baca_materi/' . $m->id_materi) ?>">View more</a>
                    </figcaption>
                </figure>
                <div class="d-flex justify-content-between tm-text-gray">
                    <span><?php echo date('d M Y') ?></span>
                    <span><?= $m->view; ?> views</span>
                </div>
            </div>
        <?php endforeach; ?>

    </div> <!-- row -->

</div> <!-- container-fluid, tm-container-content -->