<div class="container-fluid tm-container-content tm-mt-60">
    <div class="row mb-4">
        <h2 class="col-6 tm-text-primary">
            Daftar Peraturan
        </h2>
    </div>
    <div class="row tm-mb-90 tm-gallery">
        <?php foreach ($peraturan as $p): ?>
            <div class="col-xl-3 col-lg-4 col-md-6 col-sm-6 col-12 mb-5">
                <figure class="effect-ming tm-video-item">
                    <img src="<?= base_url() ?>assets/plugin_video/img/<?= $p->gambar ?>" alt="Image" class="img-fluid">
                    <figcaption class="d-flex align-items-center justify-content-center">
                        <h2><?= $p->nama_peraturan; ?></h2>
                        <a href="<?= site_url('Literasi/aturan/' . $p->id_peraturan) ?>">View more</a>
                    </figcaption>
                </figure>
                <div class="d-flex justify-content-between tm-text-gray">
                    <span><?php echo date('d M Y', strtotime($p->tgl_peraturan)) ?></span>
                    <span><?= $p->view; ?> views</span>
                </div>
            </div>
        <?php endforeach; ?>
    </div> <!-- row -->
</div> <!-- container-fluid, tm-container-content -->